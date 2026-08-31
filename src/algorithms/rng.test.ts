import { describe, it, expect } from 'vitest';
import { mulberry32, lerp, mixColor } from './rng';

describe('rng utilities', () => {
  describe('mulberry32', () => {
    it('is deterministic for a given seed', () => {
      const rng1 = mulberry32(12345);
      const rng2 = mulberry32(12345);

      for (let i = 0; i < 100; i++) {
        expect(rng1()).toBe(rng2());
      }
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = mulberry32(12345);
      const rng2 = mulberry32(67890);

      const seq1: number[] = [];
      const seq2: number[] = [];

      for (let i = 0; i < 10; i++) {
        seq1.push(rng1());
        seq2.push(rng2());
      }

      // The sequences should be different
      const allEqual = seq1.every((val, idx) => val === seq2[idx]);
      expect(allEqual).toBe(false);
    });

    it('produces values in [0, 1) over 100 draws', () => {
      const rng = mulberry32(42);

      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('lerp', () => {
    it('returns the first value at t=0', () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it('returns the second value at t=1', () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('returns the midpoint at t=0.5', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });

  describe('mixColor', () => {
    it('returns the first color at t=0', () => {
      const result = mixColor('#FF0000', '#0000FF', 0);
      expect(result).toBe('rgb(255,0,0)');
    });

    it('returns the second color at t=1', () => {
      const result = mixColor('#FF0000', '#0000FF', 1);
      expect(result).toBe('rgb(0,0,255)');
    });

    it('returns a mixed color at t=0.5', () => {
      const result = mixColor('#000000', '#FFFFFF', 0.5);
      // 0.5 lerp between 0 and 255 is 127.5, rounds to 128
      expect(result).toBe('rgb(128,128,128)');
    });
  });
});
