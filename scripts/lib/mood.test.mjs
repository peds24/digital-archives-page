import { describe, it, expect } from 'vitest';
import { classifyMood } from './mood.mjs';

describe('classifyMood', () => {
  it('classifies euphoric', () => {
    expect(classifyMood({ valence: 0.8, energy: 0.8, danceability: 0.7, tempo: 120, acousticness: 0.1 })).toBe(
      'euphoric'
    );
  });
  it('classifies melancholic', () => {
    expect(classifyMood({ valence: 0.2, energy: 0.2, danceability: 0.3, tempo: 80, acousticness: 0.7 })).toBe(
      'melancholic'
    );
  });
  it('classifies mellow', () => {
    expect(classifyMood({ valence: 0.75, energy: 0.3, danceability: 0.4, tempo: 90, acousticness: 0.4 })).toBe(
      'mellow'
    );
  });
  it('classifies intense', () => {
    expect(classifyMood({ valence: 0.3, energy: 0.85, danceability: 0.6, tempo: 150, acousticness: 0.05 })).toBe(
      'intense'
    );
  });
  it('classifies chill', () => {
    expect(classifyMood({ valence: 0.5, energy: 0.4, danceability: 0.5, tempo: 100, acousticness: 0.65 })).toBe(
      'chill'
    );
  });
  it('classifies dreamy', () => {
    expect(classifyMood({ valence: 0.55, energy: 0.6, danceability: 0.5, tempo: 95, acousticness: 0.7 })).toBe(
      'dreamy'
    );
  });
  it('falls back to a quadrant default when no recipe matches', () => {
    expect(classifyMood({ valence: 0.5, energy: 0.6, danceability: 0.5, tempo: 100, acousticness: 0.2 })).toBe(
      'euphoric'
    );
    expect(classifyMood({ valence: 0.45, energy: 0.45, danceability: 0.5, tempo: 100, acousticness: 0.2 })).toBe(
      'melancholic'
    );
  });
});
