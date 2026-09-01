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

  it('excludes queue tracks already present in the freshly-fetched latest archive, recovering from a partial prior run', async () => {
    // Simulates a rerun after a crash mid-way through a previous run: a top-off into
    // archive #29 already succeeded (so Spotify's live playlist already contains t0-t2),
    // but the run then failed before the ledger was persisted, so archivedTrackIds
    // (derived from stale public/data/archive-*.json) doesn't know about it yet.
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn();
    const queue = Array.from({ length: 10 }, (_, i) => track(`t${i}`, i));

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue([
        ...Array.from({ length: 20 }, (_, i) => ({ id: `old${i}` })),
        { id: 't0' },
        { id: 't1' },
        { id: 't2' },
      ]),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    // archive #29 has 23 tracks (20 old + t0-t2), so 7 slots remain open. t0-t2 must be
    // excluded from what's topped off — only t3..t9 (7 tracks) should be added.
    expect(addTracksToPlaylist).toHaveBeenCalledTimes(1);
    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'pl29', queue.slice(3).map((t) => t.uri));
    expect(createPlaylist).not.toHaveBeenCalled();
    expect(result).toEqual({ queue: [], addedCount: 7, createdCount: 0, pendingCount: 0 });
  });

  it('does not exclude queue tracks whose ids only coincide with unavailable placeholder entries in the latest archive', async () => {
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
      fetchPlaylistTracks: vi.fn().mockResolvedValue([
        ...Array.from({ length: 20 }, (_, i) => ({ id: `old${i}` })),
        { id: 't0', unavailable: true },
      ]),
      createPlaylist,
      addTracksToPlaylist,
      log: vi.fn(),
    });

    // t0 appears in the latest archive only as an unavailable placeholder — it must not
    // be treated as "already archived", so all 5 queue tracks (including t0) get topped off.
    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'pl29', queue.map((t) => t.uri));
    expect(result).toEqual({ queue: [], addedCount: 5, createdCount: 0, pendingCount: 0 });
  });
});
