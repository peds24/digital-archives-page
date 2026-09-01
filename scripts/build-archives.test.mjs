import { describe, it, expect, vi } from 'vitest';
import { run, parseArchiveNumber } from './build-archives.mjs';

describe('parseArchiveNumber', () => {
  it('extracts the number from a matching playlist name', () => {
    expect(parseArchiveNumber('Digital Archive #014')).toBe(14);
  });
  it('returns null for a non-matching name', () => {
    expect(parseArchiveNumber('Discover Weekly')).toBeNull();
  });
});

describe('run', () => {
  it('builds archive JSON with only real track fields, and writes an index', async () => {
    const writeFile = vi.fn();
    const log = vi.fn();

    await run({
      token: 'tok',
      fetchAllPlaylists: async () => [
        { id: 'p1', name: 'Digital Archive #014', external_urls: { spotify: 'https://open.spotify.com/playlist/p1' } },
        { id: 'p2', name: 'Discover Weekly' },
      ],
      fetchPlaylistTracks: async () => [
        {
          id: 't1', name: 'Song A', artists: ['Artist A'], album: 'Album',
          coverUrl: '', releaseDate: '2025-01-01', durationMs: 200000,
          addedAt: '2026-01-01T00:00:00Z', spotifyUrl: '', unavailable: false,
        },
        {
          id: 't2', name: 'Song B', artists: ['Artist B'], album: 'Album',
          coverUrl: '', releaseDate: '2025-01-01', durationMs: 200000,
          addedAt: '2026-01-02T00:00:00Z', spotifyUrl: '', unavailable: false,
        },
      ],
      writeFile,
      log,
    });

    const [archiveCall] = writeFile.mock.calls.filter(([name]) => name === 'archive-014.json');
    const written = JSON.parse(archiveCall[1]);
    expect(written.tracks).toHaveLength(2);

    const songA = written.tracks.find((t) => t.name === 'Song A');
    expect(Object.keys(songA).sort()).toEqual(
      ['addedAt', 'album', 'artists', 'coverUrl', 'durationMs', 'id', 'name', 'releaseDate', 'spotifyUrl', 'unavailable'].sort(),
    );
    expect(songA.mood).toBeUndefined();
    expect(songA.genres).toBeUndefined();
    expect(songA.audioFeatures).toBeUndefined();
    expect(written.spotifyUrl).toBe('https://open.spotify.com/playlist/p1');

    const [indexCall] = writeFile.mock.calls.filter(([name]) => name === 'index.json');
    const index = JSON.parse(indexCall[1]);
    expect(index.archives).toHaveLength(1);
    expect(index.archives[0].id).toBe('archive-014');
    expect(index.archives[0].dominantMood).toBeUndefined();
    expect(index.archives[0].topGenres).toBeUndefined();
    expect(index.archives[0].audioFeatureAverages).toBeUndefined();
    expect(index.archives[0].spotifyUrl).toBe('https://open.spotify.com/playlist/p1');
  });

  it('defaults spotifyUrl to an empty string when the playlist has no external_urls', async () => {
    const writeFile = vi.fn();

    await run({
      token: 'tok',
      fetchAllPlaylists: async () => [{ id: 'p2', name: 'Digital Archive #002' }],
      fetchPlaylistTracks: async () => [],
      writeFile,
    });

    const [archiveCall] = writeFile.mock.calls.filter(([name]) => name === 'archive-002.json');
    const written = JSON.parse(archiveCall[1]);
    expect(written.spotifyUrl).toBe('');

    const [indexCall] = writeFile.mock.calls.filter(([name]) => name === 'index.json');
    const index = JSON.parse(indexCall[1]);
    expect(index.archives[0].spotifyUrl).toBe('');
  });

  it('does not accept or call fetchArtistGenres or fetchAudioFeaturesBatch', async () => {
    const writeFile = vi.fn();
    const fetchArtistGenres = vi.fn();
    const fetchAudioFeaturesBatch = vi.fn();

    await run({
      token: 'tok',
      fetchAllPlaylists: async () => [{ id: 'p1', name: 'Digital Archive #001' }],
      fetchPlaylistTracks: async () => [
        {
          id: 't1', name: 'Song A', artists: ['Artist A'], album: 'Album',
          coverUrl: '', releaseDate: '2025-01-01', durationMs: 200000,
          addedAt: '2026-01-01T00:00:00Z', spotifyUrl: '', unavailable: false,
        },
      ],
      fetchArtistGenres,
      fetchAudioFeaturesBatch,
      writeFile,
    });

    expect(fetchArtistGenres).not.toHaveBeenCalled();
    expect(fetchAudioFeaturesBatch).not.toHaveBeenCalled();

    const [archiveCall] = writeFile.mock.calls.filter(([name]) => name === 'archive-001.json');
    const written = JSON.parse(archiveCall[1]);
    expect(written.tracks[0].mood).toBeUndefined();
  });
});
