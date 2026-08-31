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

function drawColorBlocks(ctx: DrawContext, s: number, rnd: () => number) {
  const palette = ['#FFD400', '#FF3E8E', '#00C2A8', '#2B4BFF', '#FF5A36'];
  ctx.fillStyle = '#141310';
  ctx.fillRect(0, 0, s, s);
  const depth = 3 + Math.floor(rnd() * 3); // was: 3 + round(features.energy * 2)
  let lastColor: string | null = null;

  function split(x: number, y: number, w: number, h: number, d: number) {
    if (d <= 0 || w < s * 0.12 || h < s * 0.12) {
      const choices = palette.filter((c) => c !== lastColor);
      const c = choices[Math.floor(rnd() * choices.length)];
      lastColor = c;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
      return;
    }
    const vertical = rnd() > 0.5;
    const ratio = lerp(0.32, 0.68, rnd());
    if (vertical) {
      const wx = w * ratio;
      split(x, y, wx, h, d - 1);
      split(x + wx, y, w - wx, h, d - 1);
    } else {
      const hy = h * ratio;
      split(x, y, w, hy, d - 1);
      split(x, y + hy, w, h - hy, d - 1);
    }
  }
  split(0, 0, s, s, depth);
}

function drawLineArt(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, s, s);
  const count = 9 + Math.floor(rnd() * 7); // was: 9 + round((1-features.energy) * 6)
  for (let i = 0; i < count; i++) {
    const w = lerp(s * 0.22, s * 0.72, rnd());
    const h = lerp(s * 0.22, s * 0.72, rnd());
    const x = rnd() * (s - w * 0.4) - w * 0.3;
    const y = rnd() * (s - h * 0.4) - h * 0.3;
    const alpha = lerp(0.35, 0.9, i / count);
    ctx.strokeStyle = `rgba(230,227,217,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1 + rnd() * 1.6;
    ctx.strokeRect(x, y, w, h);
  }
}

function drawCircleCluster(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = '#1c1712';
  ctx.fillRect(0, 0, s, s);
  const palette = ['#FF6B35', '#FF3D5A', '#FFC145', '#D93A1F', '#FF8552'];
  const count = 5 + Math.floor(rnd() * 5); // was: 5 + round((1-features.energy) * 4)
  for (let i = 0; i < count; i++) {
    const r = lerp(s * 0.22, s * 0.42, rnd());
    const cx = lerp(r * 0.5, s - r * 0.5, rnd());
    const cy = lerp(r * 0.5, s - r * 0.5, rnd());
    ctx.fillStyle = palette[i % palette.length];
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMaze(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = '#1E3AF0';
  ctx.fillRect(0, 0, s, s);
  const cells = 6 + Math.floor(rnd() * 5); // was: 6 + round(features.energy * 4)
  const cell = s / cells;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = cell * 0.34;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      if (rnd() > 0.52) continue;
      const x0 = col * cell;
      const y0 = row * cell;
      ctx.beginPath();
      if (rnd() > 0.5) {
        ctx.moveTo(x0 + cell * 0.5, y0);
        ctx.lineTo(x0 + cell * 0.5, y0 + cell);
      } else {
        ctx.moveTo(x0, y0 + cell * 0.5);
        ctx.lineTo(x0 + cell, y0 + cell * 0.5);
      }
      ctx.stroke();
    }
  }
}

function drawWaveStripes(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = '#100f0d';
  ctx.fillRect(0, 0, s, s);
  const lines = 46;
  const phase = rnd() * Math.PI * 2;
  const amp = lerp(s * 0.05, s * 0.14, rnd()); // was: lerp(..., 1-features.acousticness)
  const stops = ['#1f3a5f', '#3a6b6e', '#78a9a0', '#c9dcd2'];
  for (let i = 0; i < lines; i++) {
    const t = i / (lines - 1);
    const x0 = t * s;
    const segT = t * (stops.length - 1);
    ctx.strokeStyle = mixColor(stops[Math.floor(segT)], stops[Math.ceil(segT)], segT % 1);
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let y = 0; y <= s; y += s / 40) {
      const dx = Math.sin(y * 0.02 + phase + t * 6) * amp;
      if (y === 0) ctx.moveTo(x0 + dx, y);
      else ctx.lineTo(x0 + dx, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHalftone(ctx: DrawContext, s: number, rnd: () => number) {
  ctx.fillStyle = '#211f2b';
  ctx.fillRect(0, 0, s, s);
  const cols = 13;
  const rows = 13;
  const cell = s / cols;
  const cx = lerp(s * 0.2, s * 0.8, rnd());
  const cy = lerp(s * 0.2, s * 0.8, rnd());
  const colorA = '#C9B6FF';
  const colorB = '#FFD9A0';
  const spread = lerp(0.55, 0.9, rnd()); // was: lerp(..., 1-features.acousticness)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cell + cell / 2;
      const y = row * cell + cell / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const t = Math.min(dist / (s * spread), 1);
      const jitter = (rnd() - 0.5) * cell * 0.25;
      const radius = Math.max(lerp(cell * 0.46, cell * 0.05, t), 1);
      ctx.fillStyle = mixColor(colorA, colorB, t);
      ctx.beginPath();
      ctx.arc(x + jitter, y + jitter, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const TILE_ALGORITHMS: DrawFn[] = [
  drawColorBlocks,
  drawLineArt,
  drawCircleCluster,
  drawMaze,
  drawWaveStripes,
  drawHalftone,
];
