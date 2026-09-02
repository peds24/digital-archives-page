import { describe, it, expect, vi } from 'vitest';
import { fetchAllPlaylists, fetchPlaylistTracks, fetchLikedSongs, createPlaylist, addTracksToPlaylist } from './spotify-api.mjs';

describe('fetchAllPlaylists', () => {
  it('follows pagination via next and uses /me/playlists endpoint', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'p1', name: 'Digital Archive #001' }],
          next: 'https://api.spotify.com/v1/me/playlists?offset=50',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [{ id: 'p2', name: 'Digital Archive #002' }], next: null }),
      });
    const playlists = await fetchAllPlaylists('tok', fetchImpl);
    expect(playlists.map((p) => p.id)).toEqual(['p1', 'p2']);
    // Verify that the /me/playlists endpoint was called, not /users/
    expect(fetchImpl.mock.calls[0][0]).toContain('/me/playlists');
    expect(fetchImpl.mock.calls[0][0]).not.toContain('/users/');
  });
});

describe('fetchPlaylistTracks', () => {
  it('maps raw track items to the internal track shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            added_at: '2026-01-01T00:00:00Z',
            item: {
              id: 't1',
              name: 'Song',
              duration_ms: 200000,
              artists: [{ id: 'a1', name: 'Artist' }],
              album: { name: 'Album', release_date: '2025-01-01', images: [{ url: 'http://img' }] },
              external_urls: { spotify: 'http://open.spotify.com/track/t1' },
            },
          },
        ],
        next: null,
      }),
    });
    const tracks = await fetchPlaylistTracks('tok', 'pl1', fetchImpl);
    expect(tracks).toEqual([
      {
        id: 't1',
        name: 'Song',
        artists: ['Artist'],
        artistIds: ['a1'],
        album: 'Album',
        coverUrl: 'http://img',
        releaseDate: '2025-01-01',
        durationMs: 200000,
        addedAt: '2026-01-01T00:00:00Z',
        spotifyUrl: 'http://open.spotify.com/track/t1',
        unavailable: false,
      },
    ]);
  });

  it('produces an unavailable placeholder for a null item (fully delisted from Spotify)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-01-01T00:00:00Z', item: null },
          {
            added_at: '2026-01-02T00:00:00Z',
            item: {
              id: 't2',
              type: 'track',
              name: 'Real Song',
              duration_ms: 200000,
              artists: [{ id: 'a2', name: 'Artist' }],
              album: { name: 'Album', release_date: '2025-01-01', images: [{ url: 'http://img' }] },
              external_urls: { spotify: 'http://open.spotify.com/track/t2' },
            },
          },
        ],
        next: null,
      }),
    });
    const tracks = await fetchPlaylistTracks('tok', 'pl1', fetchImpl);
    expect(tracks).toEqual([
      {
        id: 'pl1-unavailable-1',
        name: 'Track removed from Spotify',
        artists: [],
        album: '',
        coverUrl: '',
        releaseDate: null,
        durationMs: 0,
        addedAt: '2026-01-01T00:00:00Z',
        spotifyUrl: '',
        unavailable: true,
      },
      {
        id: 't2',
        name: 'Real Song',
        artists: ['Artist'],
        artistIds: ['a2'],
        album: 'Album',
        coverUrl: 'http://img',
        releaseDate: '2025-01-01',
        durationMs: 200000,
        addedAt: '2026-01-02T00:00:00Z',
        spotifyUrl: 'http://open.spotify.com/track/t2',
        unavailable: false,
      },
    ]);
  });

  it('skips items with non-track types (e.g., episodes)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            added_at: '2026-01-01T00:00:00Z',
            item: {
              id: 'ep1',
              type: 'episode',
              name: 'Episode',
              duration_ms: 3600000,
              artists: [{ id: 'a1', name: 'Podcaster' }],
              album: { name: 'Podcast', release_date: '2025-01-01', images: [{ url: 'http://img' }] },
              external_urls: { spotify: 'http://open.spotify.com/episode/ep1' },
            },
          },
        ],
        next: null,
      }),
    });
    const tracks = await fetchPlaylistTracks('tok', 'pl1', fetchImpl);
    expect(tracks).toEqual([]);
  });

  it('produces an unavailable placeholder for a local file (is_local:true, null id, real name)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            added_at: '2026-01-01T00:00:00Z',
            item: {
              id: null,
              type: 'track',
              name: 'Nahuel Pennisi - Toco y Me Voy (En Estado Acústico)',
              duration_ms: 267000,
              artists: [{ name: '', id: null }],
              album: { album_type: null, images: [], name: '', release_date: null, artists: [] },
              external_urls: {},
              is_local: true,
            },
          },
          {
            added_at: '2026-01-02T00:00:00Z',
            item: {
              id: 't2',
              type: 'track',
              name: 'Real Song',
              duration_ms: 200000,
              artists: [{ id: 'a2', name: 'Artist' }],
              album: { name: 'Album', release_date: '2025-01-01', images: [{ url: 'http://img' }] },
              external_urls: { spotify: 'http://open.spotify.com/track/t2' },
            },
          },
        ],
        next: null,
      }),
    });
    const tracks = await fetchPlaylistTracks('tok', 'pl1', fetchImpl);
    expect(tracks).toEqual([
      {
        id: 'pl1-unavailable-1',
        name: 'Nahuel Pennisi - Toco y Me Voy (En Estado Acústico)',
        artists: [],
        album: '',
        coverUrl: '',
        releaseDate: null,
        durationMs: 267000,
        addedAt: '2026-01-01T00:00:00Z',
        spotifyUrl: '',
        unavailable: true,
      },
      {
        id: 't2',
        name: 'Real Song',
        artists: ['Artist'],
        artistIds: ['a2'],
        album: 'Album',
        coverUrl: 'http://img',
        releaseDate: '2025-01-01',
        durationMs: 200000,
        addedAt: '2026-01-02T00:00:00Z',
        spotifyUrl: 'http://open.spotify.com/track/t2',
        unavailable: false,
      },
    ]);
  });
});

describe('fetchLikedSongs', () => {
  it('maps saved-track items to the ledger shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-02-02T00:00:00Z', track: { id: 't2', name: 'Song B', uri: 'spotify:track:t2', artists: [{ name: 'Artist B' }] } },
          { added_at: '2026-02-01T00:00:00Z', track: { id: 't1', name: 'Song A', uri: 'spotify:track:t1', artists: [{ name: 'Artist A' }] } },
        ],
        next: null,
      }),
    });
    const tracks = await fetchLikedSongs('tok', new Set(), fetchImpl);
    expect(tracks).toEqual([
      { id: 't2', name: 'Song B', artists: ['Artist B'], addedAt: '2026-02-02T00:00:00Z', uri: 'spotify:track:t2' },
      { id: 't1', name: 'Song A', artists: ['Artist A'], addedAt: '2026-02-01T00:00:00Z', uri: 'spotify:track:t1' },
    ]);
    expect(fetchImpl.mock.calls[0][0]).toContain('/me/tracks');
  });

  it('stops paging once it reaches a track id already in knownIds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-02-03T00:00:00Z', track: { id: 'new1', name: 'New Song', uri: 'spotify:track:new1', artists: [{ name: 'Artist' }] } },
          { added_at: '2026-02-02T00:00:00Z', track: { id: 'seen1', name: 'Seen Song', uri: 'spotify:track:seen1', artists: [{ name: 'Artist' }] } },
        ],
        next: 'https://api.spotify.com/v1/me/tracks?offset=50',
      }),
    });
    const tracks = await fetchLikedSongs('tok', new Set(['seen1']), fetchImpl);
    expect(tracks).toEqual([
      { id: 'new1', name: 'New Song', artists: ['Artist'], addedAt: '2026-02-03T00:00:00Z', uri: 'spotify:track:new1' },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('skips local files (no catalog id) and null tracks', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { added_at: '2026-02-01T00:00:00Z', track: null },
          { added_at: '2026-02-01T00:00:00Z', track: { id: null, name: 'Local File', is_local: true, artists: [] } },
          { added_at: '2026-02-01T00:00:00Z', track: { id: 't1', name: 'Real Song', uri: 'spotify:track:t1', artists: [{ name: 'Artist' }] } },
        ],
        next: null,
      }),
    });
    const tracks = await fetchLikedSongs('tok', new Set(), fetchImpl);
    expect(tracks).toEqual([
      { id: 't1', name: 'Real Song', artists: ['Artist'], addedAt: '2026-02-01T00:00:00Z', uri: 'spotify:track:t1' },
    ]);
  });
});

describe('createPlaylist', () => {
  it('POSTs to /me/playlists with name, public:true, collaborative:false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'new-pl' }) });
    const playlist = await createPlaylist('tok', 'u1', 'Digital Archive #30', fetchImpl);
    expect(playlist).toEqual({ id: 'new-pl' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me/playlists');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Digital Archive #30', public: true, collaborative: false });
  });
});

describe('addTracksToPlaylist', () => {
  it('POSTs all uris in one call when 100 or fewer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ snapshot_id: 's1' }) });
    const uris = Array.from({ length: 30 }, (_, i) => `spotify:track:t${i}`);
    await addTracksToPlaylist('tok', 'pl1', uris, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/playlists/pl1/items');
    expect(JSON.parse(init.body).uris).toHaveLength(30);
  });

  it('chunks into multiple calls of at most 100 uris', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ snapshot_id: 's1' }) });
    const uris = Array.from({ length: 130 }, (_, i) => `spotify:track:t${i}`);
    await addTracksToPlaylist('tok', 'pl1', uris, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).uris).toHaveLength(100);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).uris).toHaveLength(30);
  });
});
