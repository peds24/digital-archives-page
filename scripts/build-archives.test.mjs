import { describe, it, expect, vi } from 'vitest';
import { run, parseArchiveNumber } from './build-archives.mjs';
import { MOOD_FEATURE_CENTROIDS } from './lib/mood.mjs';

describe('parseArchiveNumber', () => {
  it('extracts the number from a matching playlist name', () => {
    expect(parseArchiveNumber('Digital Archive #014')).toBe(14);
  });
  it('returns null for a non-matching name', () => {
    expect(parseArchiveNumber('Discover Weekly')).toBeNull();
  });
});

describe('run', () => {
  it('builds archive JSON with genre-derived moods and synthetic audio features, and writes an index', async () => {
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
      fetchArtistGenres: async () => new Map([['a1', ['indie pop']], ['a2', ['metal']]]),
      writeFile,
      log,
      warn,
    });

    const [archiveCall] = writeFile.mock.calls.filter(([name]) => name === 'archive-014.json');
    const written = JSON.parse(archiveCall[1]);
    expect(written.tracks).toHaveLength(2);

    // 'indie pop' rolls up to 'pop' (bucket order in rollupGenres matches 'pop' before 'indie'
    // is checked for this input string), which maps to 'euphoric'.
    const songA = written.tracks.find((t) => t.name === 'Song A');
    expect(songA.genres).toEqual(['pop']);
    expect(songA.mood).toBe('euphoric');

    // 'metal' -> 'intense'
    const songB = written.tracks.find((t) => t.name === 'Song B');
    expect(songB.genres).toEqual(['metal']);
    expect(songB.mood).toBe('intense');

    // No audio-features fetch call happens at all, and no track is skipped for missing features.
    expect(warn).not.toHaveBeenCalled();

    const [indexCall] = writeFile.mock.calls.filter(([name]) => name === 'index.json');
    const index = JSON.parse(indexCall[1]);
    expect(index.archives).toHaveLength(1);
    expect(index.archives[0].id).toBe('archive-014');

    // audioFeatureAverages in the summary is the average of each track's synthetic centroid.
    const expectedValence =
      (MOOD_FEATURE_CENTROIDS.euphoric.valence + MOOD_FEATURE_CENTROIDS.intense.valence) / 2;
    expect(index.archives[0].audioFeatureAverages.valence).toBeCloseTo(expectedValence);
  });

  it('does not accept or call fetchAudioFeaturesBatch', async () => {
    const writeFile = vi.fn();
    const fetchAudioFeaturesBatch = vi.fn();

    await run({
      token: 'tok',
      userId: 'pedro',
      fetchAllPlaylists: async () => [{ id: 'p1', name: 'Digital Archive #001' }],
      fetchPlaylistTracks: async () => [
        {
          id: 't1', name: 'Song A', artists: ['Artist A'], artistIds: ['a1'], album: 'Album',
          coverUrl: '', releaseDate: '2025-01-01', durationMs: 200000,
          addedAt: '2026-01-01T00:00:00Z', spotifyUrl: '',
        },
      ],
      fetchArtistGenres: async () => new Map([['a1', ['folk']]]),
      fetchAudioFeaturesBatch,
      writeFile,
    });

    expect(fetchAudioFeaturesBatch).not.toHaveBeenCalled();

    const [archiveCall] = writeFile.mock.calls.filter(([name]) => name === 'archive-001.json');
    const written = JSON.parse(archiveCall[1]);
    expect(written.tracks[0].mood).toBe('mellow');
  });
});
