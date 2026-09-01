import { describe, it, expect } from 'vitest';
import { TILE_ALGORITHMS, DARK_STOPS } from './tileAlgorithms';
import { mulberry32 } from './rng';
import type { DrawContext } from './tileAlgorithms';

function createMockContext(): { ctx: DrawContext; calls: string[] } {
  const calls: string[] = [];
  let currentFillStyle = '';
  let currentStrokeStyle = '';
  let currentLineWidth = 0;
  let currentLineCap = '';
  let currentLineJoin = '';
  let currentGlobalAlpha = 1;

  const ctx: DrawContext = {
    get fillStyle() {
      return currentFillStyle;
    },
    set fillStyle(val: string) {
      currentFillStyle = val;
    },
    get strokeStyle() {
      return currentStrokeStyle;
    },
    set strokeStyle(val: string) {
      currentStrokeStyle = val;
    },
    get lineWidth() {
      return currentLineWidth;
    },
    set lineWidth(val: number) {
      currentLineWidth = val;
    },
    get lineCap() {
      return currentLineCap;
    },
    set lineCap(val: string) {
      currentLineCap = val;
    },
    get lineJoin() {
      return currentLineJoin;
    },
    set lineJoin(val: string) {
      currentLineJoin = val;
    },
    get globalAlpha() {
      return currentGlobalAlpha;
    },
    set globalAlpha(val: number) {
      currentGlobalAlpha = val;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push(`fillRect(${x},${y},${w},${h},fill=${currentFillStyle})`);
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      calls.push(`strokeRect(${x},${y},${w},${h},stroke=${currentStrokeStyle})`);
    },
    beginPath() {
      calls.push('beginPath()');
    },
    moveTo(x: number, y: number) {
      calls.push(`moveTo(${x},${y})`);
    },
    lineTo(x: number, y: number) {
      calls.push(`lineTo(${x},${y})`);
    },
    arc(x: number, y: number, r: number, a0: number, a1: number) {
      calls.push(`arc(${x},${y},${r},${a0},${a1})`);
    },
    closePath() {
      calls.push('closePath()');
    },
    fill() {
      calls.push(`fill(fill=${currentFillStyle})`);
    },
    stroke() {
      calls.push(`stroke(stroke=${currentStrokeStyle})`);
    },
  };

  return { ctx, calls };
}

describe('tileAlgorithms', () => {
  const size = 256;

  for (let i = 0; i < TILE_ALGORITHMS.length; i++) {
    const drawFn = TILE_ALGORITHMS[i];
    const fnName = drawFn.name;

    describe(`${fnName} (algorithm ${i})`, () => {
      it('produces identical call sequences for the same seed', () => {
        const seed = 42;

        const { ctx: ctx1, calls: calls1 } = createMockContext();
        const rnd1 = mulberry32(seed);
        drawFn(ctx1, size, rnd1, DARK_STOPS);

        const { ctx: ctx2, calls: calls2 } = createMockContext();
        const rnd2 = mulberry32(seed);
        drawFn(ctx2, size, rnd2, DARK_STOPS);

        expect(calls1.length).toBeGreaterThan(0);
        expect(calls1).toEqual(calls2);
      });

      it('produces different call sequences for different seeds', () => {
        const { ctx: ctx1, calls: calls1 } = createMockContext();
        const rnd1 = mulberry32(12345);
        drawFn(ctx1, size, rnd1, DARK_STOPS);

        const { ctx: ctx2, calls: calls2 } = createMockContext();
        const rnd2 = mulberry32(67890);
        drawFn(ctx2, size, rnd2, DARK_STOPS);

        expect(calls1.length).toBeGreaterThan(0);
        expect(calls2.length).toBeGreaterThan(0);
        // The sequences should be different
        const allEqual = calls1.every((val, idx) => val === calls2[idx]);
        expect(allEqual).toBe(false);
      });
    });
  }
});
