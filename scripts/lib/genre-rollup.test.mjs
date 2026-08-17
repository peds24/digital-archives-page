import { describe, it, expect } from 'vitest';
import { rollupGenres } from './genre-rollup.mjs';

describe('rollupGenres', () => {
  it('buckets raw genres into top-level categories', () => {
    expect(rollupGenres(['chamber pop', 'indie folk', 'bedroom pop'])).toEqual(['pop', 'indie']);
  });
  it('returns at most maxGenres, most frequent first', () => {
    expect(rollupGenres(['rock', 'rock', 'pop', 'jazz'], 2)).toEqual(['rock', 'pop']);
  });
  it('falls back to other for unrecognized genres', () => {
    expect(rollupGenres(['vaporwave nostalgia'])).toEqual(['other']);
  });
});
