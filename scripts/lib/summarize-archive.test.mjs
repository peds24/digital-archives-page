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
    ...overrides,
  };
}

describe('summarizeArchive', () => {
  it('computes date range and track count', () => {
    const tracks = [
      track({ addedAt: '2026-01-01T00:00:00Z' }),
      track({ addedAt: '2026-01-03T00:00:00Z' }),
      track({ addedAt: '2026-01-02T00:00:00Z' }),
    ];
    const summary = summarizeArchive('archive-014', 14, tracks);
    expect(summary.dateRange).toEqual({ earliest: '2026-01-01T00:00:00Z', latest: '2026-01-03T00:00:00Z' });
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
