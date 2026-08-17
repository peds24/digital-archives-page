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
  it('builds archive JSON, skips failed tracks, and writes an index', async () => {
    const writeFile = vi.fn();
    const warn = vi.fn();
    const log = vi.fn();

    await run({
      token: 'tok',
      userId: 'pedro',
      fetchAllPlaylists: async () => [
        { id: 'p1', name: 'Digital Archive #014' },
        { id: 'p2', name: 'Discover Weekly' },
      ],
      fetchPlaylistTracks: async () => [
        {
          id: 't1', name: 'Song A', artists: ['Artist A'], artistIds: ['a1'], album: 'Album',
          coverUrl: '', releaseDate: '2025-01-01', durationMs: 200000,
          addedAt: '2026-01-01T00:00:00Z', spotifyUrl: '',
        },
        {
          id: 't2', name: 'Song B', artists: ['Artist B'], artistIds: ['a2'], album: 'Album',
          coverUrl: '', releaseDate: '2025-01-01', durationMs: 200000,
          addedAt: '2026-01-02T00:00:00Z', spotifyUrl: '',
        },
      ],
      fetchAudioFeaturesBatch: async () =>
        new Map([['t1', { valence: 0.8, energy: 0.8, danceability: 0.7, tempo: 120, acousticness: 0.1 }]]),
      fetchArtistGenres: async () => new Map([['a1', ['indie pop']]]),
      writeFile,
      log,
      warn,
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Song B'));

    const [archiveCall] = writeFile.mock.calls.filter(([name]) => name === 'archive-014.json');
    const written = JSON.parse(archiveCall[1]);
    expect(written.tracks).toHaveLength(1);
    expect(written.tracks[0].mood).toBe('euphoric');
    expect(written.tracks[0].genres).toEqual(['pop']);

    const [indexCall] = writeFile.mock.calls.filter(([name]) => name === 'index.json');
    const index = JSON.parse(indexCall[1]);
    expect(index.archives).toHaveLength(1);
    expect(index.archives[0].id).toBe('archive-014');
  });
});
