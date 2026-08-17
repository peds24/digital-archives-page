import { describe, it, expect } from 'vitest';
import { classifyMood, MOOD_FEATURE_CENTROIDS } from './mood.mjs';

describe('classifyMood', () => {
  it.each([
    ['pop', 'euphoric'],
    ['electronic', 'euphoric'],
    ['latin', 'euphoric'],
    ['hip-hop', 'euphoric'],
    ['rock', 'intense'],
    ['metal', 'intense'],
    ['punk', 'intense'],
    ['jazz', 'chill'],
    ['reggae', 'chill'],
    ['r&b', 'chill'],
    ['folk', 'mellow'],
    ['country', 'mellow'],
    ['indie', 'dreamy'],
    ['classical', 'dreamy'],
  ])('maps top genre %s to mood %s', (genre, mood) => {
    expect(classifyMood([genre])).toBe(mood);
  });

  it('uses only the head genre when several are present', () => {
    expect(classifyMood(['rock', 'pop', 'jazz'])).toBe('intense');
  });

  it('falls back to melancholic for an empty genre list', () => {
    expect(classifyMood([])).toBe('melancholic');
  });

  it('falls back to melancholic for an unrecognized genre', () => {
    expect(classifyMood(['other'])).toBe('melancholic');
  });

  it('falls back to melancholic when genres is undefined', () => {
    expect(classifyMood(undefined)).toBe('melancholic');
  });
});

describe('MOOD_FEATURE_CENTROIDS', () => {
  it('has all six moods with the documented values', () => {
    expect(MOOD_FEATURE_CENTROIDS).toEqual({
      euphoric: { valence: 0.8, energy: 0.8, danceability: 0.7, tempo: 120, acousticness: 0.1 },
      melancholic: { valence: 0.2, energy: 0.2, danceability: 0.3, tempo: 80, acousticness: 0.7 },
      mellow: { valence: 0.75, energy: 0.3, danceability: 0.4, tempo: 90, acousticness: 0.4 },
      intense: { valence: 0.3, energy: 0.85, danceability: 0.6, tempo: 150, acousticness: 0.05 },
      chill: { valence: 0.5, energy: 0.4, danceability: 0.5, tempo: 100, acousticness: 0.65 },
      dreamy: { valence: 0.55, energy: 0.6, danceability: 0.5, tempo: 95, acousticness: 0.7 },
    });
  });
});
