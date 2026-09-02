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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
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
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    // t0 appears in the latest archive only as an unavailable placeholder — it must not
    // be treated as "already archived", so all 5 queue tracks (including t0) get topped off.
    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'pl29', queue.map((t) => t.uri));
    expect(result).toEqual({ queue: [], addedCount: 5, createdCount: 0, pendingCount: 0 });
  });

  it('reconciles every unreconciled archive (not just the latest) so a track already in an older new archive is not duplicated into a newer one', async () => {
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn();
    // 30 tracks already sitting in archive #30 (created and filled in a prior run that
    // crashed before archive #31 was filled or the ledger/public-data were persisted),
    // plus 3 genuinely new pending tracks.
    const alreadyInArchive30 = Array.from({ length: 30 }, (_, i) => track(`dup${i}`, i));
    const genuinelyNew = [track('new0', 30), track('new1', 31), track('new2', 32)];
    const queue = [...alreadyInArchive30, ...genuinelyNew];

    const fetchPlaylistTracks = vi.fn().mockImplementation(async (t, playlistId) => {
      if (playlistId === 'pl30') return alreadyInArchive30.map((tr) => ({ id: tr.id, unavailable: false }));
      if (playlistId === 'pl31') return [];
      throw new Error(`unexpected playlist id: ${playlistId}`);
    });

    const result = await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(), // local public/data is stale — doesn't know about #30 yet
      localMaxArchiveNumber: 29, // local data only covers through #29
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([
        { id: 'pl31', name: 'Digital Archive #31' },
        { id: 'pl30', name: 'Digital Archive #30' },
      ]),
      fetchPlaylistTracks,
      createPlaylist,
      addTracksToPlaylist,
      updatePlaylistDetails: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    // Only the 3 genuinely new tracks get added to #31 — the 30 already in #30 are excluded.
    expect(addTracksToPlaylist).toHaveBeenCalledTimes(1);
    expect(addTracksToPlaylist).toHaveBeenCalledWith('tok', 'pl31', genuinelyNew.map((t) => t.uri));
    expect(createPlaylist).not.toHaveBeenCalled();
    expect(result.addedCount).toBe(3);
    expect(result.pendingCount).toBe(0);
  });

  it('sets a new archive\'s description to its date range', async () => {
    const updatePlaylistDetails = vi.fn().mockResolvedValue(undefined);
    const createPlaylist = vi.fn().mockResolvedValue({ id: 'new-pl' });
    const queue = Array.from({ length: 30 }, (_, i) => track(`t${i}`, i));

    await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([]),
      fetchPlaylistTracks: vi.fn(),
      createPlaylist,
      addTracksToPlaylist: vi.fn().mockResolvedValue(undefined),
      updatePlaylistDetails,
      log: vi.fn(),
    });

    // All 30 tracks share the same date (Jan 1, 2026, minutes apart), so the range collapses to one day.
    expect(updatePlaylistDetails).toHaveBeenCalledWith('tok', 'new-pl', { description: 'Jan 1, 2026 – Jan 1, 2026' });
  });

  it("sets a topped-off archive's description from both its existing and newly-added tracks' dates", async () => {
    const updatePlaylistDetails = vi.fn().mockResolvedValue(undefined);
    const queue = [track('new0', 100)]; // Jan 1, 2026 (100 minutes in)

    await run({
      token: 'tok',
      userId: 'u1',
      queue,
      archivedTrackIds: new Set(),
      fetchLikedSongs: vi.fn().mockResolvedValue([]),
      fetchAllPlaylists: vi.fn().mockResolvedValue([{ id: 'pl29', name: 'Digital Archive #29' }]),
      fetchPlaylistTracks: vi.fn().mockResolvedValue([
        { id: 'old0', unavailable: false, addedAt: '2025-11-05T00:00:00Z' },
      ]),
      createPlaylist: vi.fn(),
      addTracksToPlaylist: vi.fn().mockResolvedValue(undefined),
      updatePlaylistDetails,
      log: vi.fn(),
    });

    expect(updatePlaylistDetails).toHaveBeenCalledWith('tok', 'pl29', {
      description: 'Nov 5, 2025 – Jan 1, 2026',
    });
  });

  it('does not abort the run or block the ledger when updating the description fails', async () => {
    const updatePlaylistDetails = vi.fn().mockRejectedValue(new Error('Spotify API request failed (500): /playlists/new-pl'));
    const createPlaylist = vi.fn().mockResolvedValue({ id: 'new-pl' });
    const addTracksToPlaylist = vi.fn().mockResolvedValue(undefined);
    const queue = Array.from({ length: 30 }, (_, i) => track(`t${i}`, i));
    const log = vi.fn();

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
      updatePlaylistDetails,
      log,
    });

    expect(addTracksToPlaylist).toHaveBeenCalled();
    expect(result).toEqual({ queue: [], addedCount: 30, createdCount: 1, pendingCount: 0 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Warning: failed to update playlist description'));
  });
});
