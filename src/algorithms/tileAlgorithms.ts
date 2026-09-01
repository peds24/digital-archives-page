import { lerp, mixColor } from './rng';

export interface DrawContext {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
}

export type DrawFn = (ctx: DrawContext, size: number, rnd: () => number) => void;

// Single shared hue family for every tile: near-black terminal green up
// through the theme accent (#1DB954) to a bright phosphor/mint highlight.
// All six algorithms draw exclusively from this ramp so differentiation
// between them comes from texture/structure, never color.
const GREEN_STOPS = ['#050A06', '#0B2013', '#136B36', '#1DB954', '#63FFA6', '#D4FFEA'];

function greenAt(t: number): string {
  const clamped = Math.min(Math.max(t, 0), 1);
  const segCount = GREEN_STOPS.length - 1;
  const segT = clamped * segCount;
  const i = Math.min(Math.floor(segT), segCount - 1);
  return mixColor(GREEN_STOPS[i], GREEN_STOPS[i + 1], segT - i);
}

/** Matrix-style falling character rain: columns of glyph blocks with a bright head fading to the dark ground. */
function drawCodeRain(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = GREEN_STOPS[0];
  ctx.fillRect(0, 0, s, s);
  const cols = 14 + Math.floor(rnd() * 6);
  const colW = s / cols;
  const glyph = colW * 0.62;
  const rowH = s / 18;
  for (let c = 0; c < cols; c++) {
    const x = c * colW + (colW - glyph) / 2;
    const streakLen = 4 + Math.floor(rnd() * 11);
    const startRow = Math.floor(rnd() * 8);
    for (let i = 0; i < streakLen; i++) {
      const row = startRow + i;
      const y = row * rowH;
      if (y > s) break;
      const fade = i / streakLen;
      const dim = rnd() < 0.12;
      ctx.globalAlpha = dim ? 0.25 : lerp(0.95, 0.18, fade);
      ctx.fillStyle = greenAt(lerp(1, 0.15, fade));
      ctx.fillRect(x, y, glyph, rowH * 0.7);
    }
  }
  ctx.globalAlpha = 1;
}

/** Circuit-board traces: right-angle wires walking a grid between vias (pad circles). */
function drawCircuitTraces(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = GREEN_STOPS[1];
  ctx.fillRect(0, 0, s, s);
  const grid = 8 + Math.floor(rnd() * 4);
  const cell = s / grid;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  const traceCount = 10 + Math.floor(rnd() * 8);
  for (let t = 0; t < traceCount; t++) {
    let gx = Math.floor(rnd() * grid);
    let gy = Math.floor(rnd() * grid);
    const segs = 3 + Math.floor(rnd() * 5);
    const shade = greenAt(lerp(0.35, 0.85, rnd()));
    ctx.strokeStyle = shade;
    ctx.lineWidth = cell * 0.12;
    ctx.beginPath();
    ctx.moveTo(gx * cell + cell / 2, gy * cell + cell / 2);
    for (let seg = 0; seg < segs; seg++) {
      if (rnd() > 0.5) {
        gx = Math.max(0, Math.min(grid - 1, gx + (rnd() > 0.5 ? 1 : -1)));
      } else {
        gy = Math.max(0, Math.min(grid - 1, gy + (rnd() > 0.5 ? 1 : -1)));
      }
      ctx.lineTo(gx * cell + cell / 2, gy * cell + cell / 2);
    }
    ctx.stroke();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(gx * cell + cell / 2, gy * cell + cell / 2, cell * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Hex-dump / byte grid: a monospace grid of glyph cells at varying brightness, with one scanned highlight row. */
function drawHexDump(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = GREEN_STOPS[0];
  ctx.fillRect(0, 0, s, s);
  const cols = 16;
  const rows = 16;
  const cellW = s / cols;
  const cellH = s / rows;
  const highlightRow = Math.floor(rnd() * rows);
  const pad = cellW * 0.13;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = rnd();
      let brightness = 0.12 + v * 0.5;
      if (row === highlightRow) brightness = Math.min(1, brightness + 0.4);
      ctx.fillStyle = greenAt(brightness);
      ctx.fillRect(col * cellW + pad, row * cellH + pad, cellW - pad * 2, cellH - pad * 2);
    }
  }
}

/** Git-diff gutter: stacked code-line bars, some added (bright), some removed (dim), with a gutter tick per line. */
function drawDiffGutter(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = GREEN_STOPS[1];
  ctx.fillRect(0, 0, s, s);
  const lines = 20;
  const lineH = s / lines;
  const gutter = s * 0.12;
  for (let i = 0; i < lines; i++) {
    const y = i * lineH;
    const kind = rnd();
    const len = lerp(s * 0.15, s * 0.82, rnd());
    let barBrightness: number;
    let barAlpha: number;
    if (kind < 0.32) {
      barBrightness = 0.85; // added line
      barAlpha = 0.85;
    } else if (kind < 0.55) {
      barBrightness = 0.22; // removed line
      barAlpha = 0.4;
    } else {
      barBrightness = 0.5; // unchanged line
      barAlpha = 0.6;
    }
    ctx.globalAlpha = barAlpha;
    ctx.fillStyle = greenAt(barBrightness);
    ctx.fillRect(gutter, y + lineH * 0.2, len, lineH * 0.58);

    ctx.globalAlpha = 1;
    ctx.fillStyle = greenAt(Math.min(1, barBrightness + 0.15));
    ctx.fillRect(gutter * 0.32, y + lineH * 0.28, gutter * 0.32, lineH * 0.42);
  }
  ctx.globalAlpha = 1;
}

/** Dependency/call graph: scattered nodes joined by directed edges, node size and glow scaled by "importance". */
function drawNodeGraph(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = GREEN_STOPS[0];
  ctx.fillRect(0, 0, s, s);
  const count = 8 + Math.floor(rnd() * 6);
  const nodes: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    nodes.push([lerp(s * 0.1, s * 0.9, rnd()), lerp(s * 0.1, s * 0.9, rnd())]);
  }
  ctx.lineWidth = 1.2;
  for (let i = 0; i < count; i++) {
    const edges = 1 + Math.floor(rnd() * 2);
    for (let e = 0; e < edges; e++) {
      const j = Math.floor(rnd() * count);
      ctx.strokeStyle = greenAt(lerp(0.2, 0.5, rnd()));
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(nodes[i][0], nodes[i][1]);
      ctx.lineTo(nodes[j][0], nodes[j][1]);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < count; i++) {
    const r = lerp(s * 0.02, s * 0.045, rnd());
    ctx.fillStyle = greenAt(lerp(0.55, 1, rnd()));
    ctx.beginPath();
    ctx.arc(nodes[i][0], nodes[i][1], r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** CRT terminal phosphor: horizontal scanlines with flicker, overlaid with blinking cursor blocks. */
function drawScanlinePhosphor(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = GREEN_STOPS[0];
  ctx.fillRect(0, 0, s, s);
  const lineCount = 40;
  const lineH = s / lineCount;
  for (let i = 0; i < lineCount; i++) {
    const flicker = 0.25 + rnd() * 0.5;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = greenAt(lerp(0.2, 0.7, i / lineCount));
    ctx.fillRect(0, i * lineH, s, lineH * 0.5);
  }
  ctx.globalAlpha = 1;
  const cursors = 3 + Math.floor(rnd() * 4);
  const cell = s / 16;
  for (let i = 0; i < cursors; i++) {
    const cx = Math.floor(rnd() * 14) * cell;
    const cy = Math.floor(rnd() * 14) * cell;
    ctx.fillStyle = greenAt(lerp(0.7, 1, rnd()));
    ctx.fillRect(cx, cy, cell * 0.8, cell * 1.4);
  }
}

export const TILE_ALGORITHMS: DrawFn[] = [
  drawCodeRain,
  drawCircuitTraces,
  drawHexDump,
  drawDiffGutter,
  drawNodeGraph,
  drawScanlinePhosphor,
];
