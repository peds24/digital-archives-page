import { describe, it, expect } from 'vitest';
import { summarizeArchive } from './summarize-archive.mjs';

function track(overrides) {
  return {
    id: 't',
    name: 'n',
    artists: ['a'],
    album: 'al',
    coverUrl: '',
    releaseDate: '2025-01-01',
    durationMs: 200000,
    addedAt: '2026-01-01T00:00:00Z',
    spotifyUrl: '',
    mood: 'euphoric',
    genres: ['pop'],
    audioFeatures: { valence: 0.8, energy: 0.8, danceability: 0.7, tempo: 120, acousticness: 0.1 },
    ...overrides,
  };
}

describe('summarizeArchive', () => {
  it('computes dominant mood, top genres, date range, and averages', () => {
    const tracks = [
      track({ mood: 'euphoric', genres: ['pop'], addedAt: '2026-01-01T00:00:00Z' }),
      track({ mood: 'euphoric', genres: ['pop'], addedAt: '2026-01-03T00:00:00Z' }),
      track({ mood: 'mellow', genres: ['indie'], addedAt: '2026-01-02T00:00:00Z' }),
    ];
    const summary = summarizeArchive('archive-014', 14, tracks);
    expect(summary.dominantMood).toBe('euphoric');
    expect(summary.topGenres).toEqual(['pop', 'indie']);
    expect(summary.dateRange).toEqual({ earliest: '2026-01-01T00:00:00Z', latest: '2026-01-03T00:00:00Z' });
    expect(summary.audioFeatureAverages.valence).toBeCloseTo(0.8);
    expect(summary.trackCount).toBe(3);
  });

  it('marks archives under 30 tracks as in progress', () => {
    const summary = summarizeArchive('archive-020', 20, [track({})]);
    expect(summary.inProgress).toBe(true);
  });

  it('marks archives with 30 or more tracks as complete', () => {
    const tracks = Array.from({ length: 30 }, () => track({}));
    const summary = summarizeArchive('archive-001', 1, tracks);
    expect(summary.inProgress).toBe(false);
  });
});
