import { describe, it, expect } from 'vitest';
import { toQueueTrack, clampIndex, randomIndex, isPreviewPlayback, formatTime } from './nowPlaying';
import type { Track } from './types';

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    name: 'Track Name',
    artists: ['Artist'],
    album: 'Album',
    coverUrl: 'https://example.com/cover.jpg',
    releaseDate: '2025-01-01',
    durationMs: 200000,
    addedAt: '2026-01-01',
    spotifyUrl: 'https://open.spotify.com/track/track-1',
    unavailable: false,
    ...overrides,
  };
}

describe('toQueueTrack', () => {
  it('picks only the fields the queue/player needs', () => {
    expect(toQueueTrack(track())).toEqual({
      id: 'track-1',
      name: 'Track Name',
      artists: ['Artist'],
      coverUrl: 'https://example.com/cover.jpg',
      durationMs: 200000,
    });
  });
});

describe('clampIndex', () => {
  it('clamps below zero up to zero', () => {
    expect(clampIndex(-3, 5)).toBe(0);
  });

  it('clamps above the last index down to the last index', () => {
    expect(clampIndex(10, 5)).toBe(4);
  });

  it('passes through an in-range index unchanged', () => {
    expect(clampIndex(2, 5)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(clampIndex(3, 0)).toBe(0);
  });
});

describe('randomIndex', () => {
  it('returns 0 for an empty list', () => {
    expect(randomIndex(0)).toBe(0);
  });

  it('picks the lowest index when rnd returns 0', () => {
    expect(randomIndex(5, () => 0)).toBe(0);
  });

  it('picks the highest index when rnd returns just under 1', () => {
    expect(randomIndex(5, () => 0.999)).toBe(4);
  });

  it('stays in bounds across a range of rnd outputs', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const index = randomIndex(7, () => r);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(7);
    }
  });
});

describe('isPreviewPlayback', () => {
  it('is false when the embed duration matches the known track duration', () => {
    expect(isPreviewPlayback(200000, 200000)).toBe(false);
  });

  it('is true when the embed duration is far shorter than the known track duration (anonymous preview)', () => {
    expect(isPreviewPlayback(30000, 200000)).toBe(true);
  });

  it('is false when either duration is not yet known (0)', () => {
    expect(isPreviewPlayback(0, 200000)).toBe(false);
    expect(isPreviewPlayback(30000, 0)).toBe(false);
  });

  it('tolerates small natural differences under the threshold', () => {
    expect(isPreviewPlayback(199000, 200000)).toBe(false);
  });
});

describe('formatTime', () => {
  it('formats sub-minute durations', () => {
    expect(formatTime(45000)).toBe('0:45');
  });

  it('pads seconds under 10', () => {
    expect(formatTime(65000)).toBe('1:05');
  });

  it('floors partial seconds', () => {
    expect(formatTime(1999)).toBe('0:01');
  });

  it('returns 0:00 for zero, negative, or non-finite input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-100)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});
