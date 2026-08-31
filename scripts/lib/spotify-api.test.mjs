import { describe, it, expect, vi } from 'vitest';
import { fetchAllPlaylists, fetchPlaylistTracks } from './spotify-api.mjs';

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
      },
    ]);
  });

  it('skips items with a null item (removed from Spotify)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ added_at: '2026-01-01T00:00:00Z', item: null }], next: null }),
    });
    const tracks = await fetchPlaylistTracks('tok', 'pl1', fetchImpl);
    expect(tracks).toEqual([]);
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

  it('skips local-file tracks (type:"track" but null id) and records them in the skipped list', async () => {
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
              name: 'Some Local Recording',
              duration_ms: 200000,
              artists: [{ id: null, name: '' }],
              album: { name: '', release_date: null, images: [] },
              external_urls: {},
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
    const skipped = [];
    const tracks = await fetchPlaylistTracks('tok', 'pl1', fetchImpl, skipped);
    expect(tracks).toEqual([
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
      },
    ]);
    expect(skipped).toEqual([{ name: 'Some Local Recording', artists: [''] }]);
  });
});
