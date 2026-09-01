import { describe, it, expect, vi } from 'vitest';
import { run } from './archive-liked-songs.mjs';

const track = (id, order) => ({
  id,
  name: `Song ${id}`,
  artists: ['Artist'],
  addedAt: new Date(Date.UTC(2026, 0, 1, 0, order)).toISOString(),
  uri: `spotify:track:${id}`,
});

describe('run', () => {
  it('creates the first archive when none exist and exactly 30 are pending', async () => {
    const createPlaylist = vi.fn().mockResolvedValue({ id: 'new-pl' });
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const queue = Array.from({ length: 30 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([]),
      fetchPlaylistTracks: vi.fn(),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(createPlaylist).toHaveBeenCalledWith('tok', 'u1', 'Digital Archive #1');
    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'new-pl', queue.map((t) => t.uri));
    expect(result).toEqual({ queue: [], addedCount: 30, createdCount: 1, pendingCount: 0 });
  });

  it('tops off an open archive without creating a new one', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn();
    const queue = Array.from({ length: 5 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue(Array.from({ length: 22 }, (_, i) => ({ id: `old${i}` }))),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'pl29', queue.map((t) => t.uri));
    expect(createPlaylist).not.toHaveBeenCalled();
    expect(result).toEqual({ queue: [], addedCount: 5, createdCount: 0, pendingCount: 0 });
  });

  it('tops off the open archive then creates a new one for the overflow', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn().mockResolvedValue({ id: 'new-pl' });
    const queue = Array.from({ length: 40 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue(Array.from({ length: 22 }, (_, i) => ({ id: `old${i}` }))),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(addTracksToPlaylist).toHaveBeenNthCalledWith(1, 'tok', 'pl29', queue.slice(0, 8).map((t) => t.uri));
    expect(createPlaylist).toHaveBeenCalledWith('tok', 'u1', 'Digital Archive #30');
    expect(addTracksToPlaylist).toHaveBeenNthCalledWith(2, 'tok', 'new-pl', queue.slice(8, 38).map((t) => t.uri));
    expect(result.createdCount).toBe(1);
    expect(result.addedCount).toBe(38);
    expect(result.pendingCount).toBe(2);
  });

  it('creates multiple new archives numbered after the latest existing one when it is already full', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn().mockResolvedValueOnce({ id: 'pl-a' }).mockResolvedValueOnce({ id: 'pl-b' });
    const queue = Array.from({ length: 65 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: `old${i}` }))),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    expect(createPlaylist).toHaveBeenNthCalledWith(1, 'tok', 'u1', 'Digital Archive #30');
    expect(createPlaylist).toHaveBeenNthCalledWith(2, 'tok', 'u1', 'Digital Archive #31');
    expect(result.createdCount).toBe(2);
    expect(result.pendingCount).toBe(5);
  });

  it('drops queue entries that are already archived, and passes the union of queue+archived ids as knownIds', async () => {
    const fetchLikedSongs = vi.fn().mockResolvedValue([]);
    const queue = [track('already-archived', 0), track('still-pending', 1)];

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(['already-archived', 'from-a-past-archive']),
      fetchLikedSongs,
      fetchAllPlaylists: vi.fn().mockResolvedValue([]),
      fetchPlaylistTracks: vi.fn(),
      createPlaylist: vi.fn(),
      addTracksToPlaylist: vi.fn(),
      log: vi.fn(),
    });

    expect(result.queue.map((t) => t.id)).toEqual(['still-pending']);
    const knownIds = fetchLikedSongs.mock.calls[0][1];
    expect(knownIds).toEqual(new Set(['already-archived', 'still-pending', 'from-a-past-archive']));
  });
});
