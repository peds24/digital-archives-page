import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../algorithms/rng';
import { discoverTracks } from './discoverTracks';
import type { DiscoverableTrack } from './types';

function track(overrides: Partial<DiscoverableTrack> = {}): DiscoverableTrack {
  return {
    id: 'track-001',
    name: 'Track Name',
    artists: ['Artist'],
    album: 'Album Name',
    coverUrl: '',
    releaseDate: '2025-01-01',
    durationMs: 200000,
    addedAt: '2026-01-01',
    spotifyUrl: '',
    unavailable: false,
    archiveId: 'archive-001',
    archiveNumber: 1,
    ...overrides,
  };
}

describe('discoverTracks', () => {
  it('returns at most count tracks with no duplicate artists when pool has enough diversity', () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      track({
        id: `track-${i}`,
        name: `Track ${i}`,
        artists: [`Artist${i}`],
      })
    );

    const results = discoverTracks(pool, 5);

    expect(results).toHaveLength(5);

    const firstArtists = results.map((t) => t.artists[0]);
    const uniqueArtists = new Set(firstArtists);
    expect(uniqueArtists.size).toBe(5);
  });

  it('falls back to allowing artist repeats when not enough diversity', () => {
    const pool = Array.from({ length: 3 }, (_, i) =>
      track({
        id: `track-${i}`,
        name: `Track ${i}`,
        artists: ['SharedArtist'],
      })
    );

    const results = discoverTracks(pool, 3);

    expect(results).toHaveLength(3);
  });

  it('spreads picks across archives when the pool has enough archive diversity', () => {
    // 12 archives, 2 tracks each, every track a distinct artist — plenty of room to
    // pick 5 tracks from 5 distinct archives without falling back to repeats.
    const pool = Array.from({ length: 12 }, (_, archiveIndex) =>
      Array.from({ length: 2 }, (_, trackIndex) =>
        track({
          id: `track-${archiveIndex}-${trackIndex}`,
          name: `Track ${archiveIndex}-${trackIndex}`,
          artists: [`Artist${archiveIndex}-${trackIndex}`],
          archiveId: `archive-${String(archiveIndex).padStart(3, '0')}`,
          archiveNumber: archiveIndex,
        })
      )
    ).flat();

    const results = discoverTracks(pool, 5);

    expect(results).toHaveLength(5);
    const distinctArchives = new Set(results.map((t) => t.archiveId));
    expect(distinctArchives.size).toBe(5);
  });

  it('is deterministic for a given rnd sequence', () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      track({
        id: `track-${i}`,
        name: `Track ${i}`,
        artists: [`Artist${i}`],
      })
    );

    const rnd1 = mulberry32(42);
    const results1 = discoverTracks(pool, 5, rnd1);
    const ids1 = results1.map((t) => t.id);

    const rnd2 = mulberry32(42);
    const results2 = discoverTracks(pool, 5, rnd2);
    const ids2 = results2.map((t) => t.id);

    expect(ids1).toEqual(ids2);
  });
});
