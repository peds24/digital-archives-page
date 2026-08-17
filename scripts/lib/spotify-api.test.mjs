import { describe, it, expect, vi } from 'vitest';
import {
  fetchAllPlaylists,
  fetchPlaylistTracks,
  fetchAudioFeaturesBatch,
} from './spotify-api.mjs';

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
    const playlists = await fetchAllPlaylists('tok', 'u', fetchImpl);
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
});

describe('fetchAudioFeaturesBatch', () => {
  it('builds a map keyed by track id, skipping nulls', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        audio_features: [
          { id: 't1', valence: 0.8, energy: 0.7, danceability: 0.6, tempo: 120, acousticness: 0.1 },
          null,
        ],
      }),
    });
    const map = await fetchAudioFeaturesBatch('tok', ['t1', 't2'], fetchImpl);
    expect(map.get('t1')).toEqual({ valence: 0.8, energy: 0.7, danceability: 0.6, tempo: 120, acousticness: 0.1 });
    expect(map.has('t2')).toBe(false);
  });
});
