import { mulberry32 } from '../algorithms/rng';
import type { DrawContext, DrawFn } from '../algorithms/tileAlgorithms';

/** Renders a seeded generative tile into a canvas, sized to its own client width. */
export function drawTile(canvas: HTMLCanvasElement, algorithm: DrawFn, seed: number, stops: string[]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 320;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const rnd = mulberry32(seed);
  algorithm(ctx as unknown as DrawContext, size, rnd, stops);
}
