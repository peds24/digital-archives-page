export interface AlgorithmInfo {
  name: string;
  summary: string;
  math: string;
  code: string;
}

// One entry per index in TILE_ALGORITHMS (src/algorithms/tileAlgorithms.ts), in
// the same order. The code excerpts are hand-transcribed rather than pulled
// from the running function at render time — a production build minifies
// function bodies, so `fn.toString()` would print mangled single-letter
// garbage instead of anything a visitor could read.
export const ALGORITHM_INFO: AlgorithmInfo[] = [
  {
    name: 'code rain',
    summary: 'Matrix-style falling glyph columns, bright head fading to the ground.',
    math:
      "14–19 columns are laid out evenly across the tile. Each column gets its own streak: a start row (0–7) and a length (4–14 cells), drawn as stacked rects. Within a streak, position i/length maps through a fade curve — alpha runs from 0.95 down to 0.18, and color is sampled from the ramp at t = lerp(1, 0.15, fade), so the leading cell sits near the ramp's brightest stop and the tail dissolves toward its dimmest. About 12% of cells get knocked down to a flat 0.25 alpha regardless of position, for the odd flicker.",
    code:
`const cols = 14 + Math.floor(rnd() * 6);
for (let c = 0; c < cols; c++) {
  const streakLen = 4 + Math.floor(rnd() * 11);
  const startRow = Math.floor(rnd() * 8);
  for (let i = 0; i < streakLen; i++) {
    const fade = i / streakLen;
    ctx.globalAlpha = rnd() < 0.12 ? 0.25 : lerp(0.95, 0.18, fade);
    ctx.fillStyle = colorAt(stops, lerp(1, 0.15, fade));
    ctx.fillRect(x, row * rowH, glyphW, rowH * 0.7);
  }
}`,
  },
  {
    name: 'circuit traces',
    summary: 'Right-angle wires random-walking between vias on a coarse grid.',
    math:
      "An 8–11 cell grid is laid over the tile. 10–17 traces are drawn: each starts at a random cell and takes 3–7 steps, moving one cell along either the x or y axis per step (picked randomly, clamped to the grid) — never diagonally, which is what gives the right-angle PCB look. Every trace gets one color, sampled once from the ramp in the [0.35, 0.85] range, used for both its line and the filled via (circle) at its final vertex.",
    code:
`const grid = 8 + Math.floor(rnd() * 4);
for (let t = 0; t < traceCount; t++) {
  let gx = Math.floor(rnd() * grid), gy = Math.floor(rnd() * grid);
  const shade = colorAt(stops, lerp(0.35, 0.85, rnd()));
  for (let seg = 0; seg < segs; seg++) {
    if (rnd() > 0.5) gx = clamp(gx + (rnd() > 0.5 ? 1 : -1));
    else gy = clamp(gy + (rnd() > 0.5 ? 1 : -1));
    ctx.lineTo(gx * cell + cell / 2, gy * cell + cell / 2);
  }
  ctx.stroke();
  ctx.arc(gx * cell + cell / 2, gy * cell + cell / 2, cell * 0.14, 0, Math.PI * 2);
  ctx.fill();
}`,
  },
  {
    name: 'hex dump',
    summary: 'A fixed 16×16 glyph grid with one scanned highlight row.',
    math:
      "Every cell in a fixed 16×16 grid gets an independent random brightness, 0.12 to 0.62. One row is chosen at random and pushed brighter (+0.4, capped at 1) — the 'scanned' row a hex viewer's cursor would sit on. Brightness maps directly to a ramp position via colorAt, so the whole tile is one lookup per cell, no shape math beyond a grid of rects.",
    code:
`const highlightRow = Math.floor(rnd() * rows);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    let brightness = 0.12 + rnd() * 0.5;
    if (row === highlightRow) brightness = Math.min(1, brightness + 0.4);
    ctx.fillStyle = colorAt(stops, brightness);
    ctx.fillRect(col * cellW + pad, row * cellH + pad, cellW - pad * 2, cellH - pad * 2);
  }
}`,
  },
  {
    name: 'diff gutter',
    summary: 'Stacked code-line bars — added, removed, unchanged — with a gutter tick.',
    math:
      "20 fixed horizontal lines, each independently classified: 32% added (bright, alpha 0.85), 23% removed (dim, alpha 0.4), the rest unchanged (mid, alpha 0.6). Bar length is randomized per line (15%–82% of tile width) regardless of class, and every line gets a second, brighter tick mark in the gutter — a fixed offset from its bar's own brightness rather than the ramp's low end, so the gutter always reads slightly hotter than the line it marks.",
    code:
`for (let i = 0; i < lines; i++) {
  const kind = rnd();
  const [brightness, alpha] =
    kind < 0.32 ? [0.85, 0.85] : kind < 0.55 ? [0.22, 0.4] : [0.5, 0.6];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colorAt(stops, brightness);
  ctx.fillRect(gutter, y, lerp(s * 0.15, s * 0.82, rnd()), lineH * 0.58);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colorAt(stops, Math.min(1, brightness + 0.15));
  ctx.fillRect(gutter * 0.32, y, gutter * 0.32, lineH * 0.42);
}`,
  },
  {
    name: 'node graph',
    summary: 'A scattered dependency graph — edges first, then sized nodes on top.',
    math:
      "8–13 nodes are scattered at random (x, y) within the tile's inner 80%. Each node draws 1–2 edges to a randomly chosen other node (including, occasionally, itself) at low alpha, so busier regions layer up naturally. Nodes are drawn last, on top of every edge, each with its own independent radius (2%–4.5% of tile size) and brightness — the two aren't linked, so a node's size says nothing about its color, only about how much of the graph a viewer's eye lands on.",
    code:
`for (let i = 0; i < count; i++) {
  const edges = 1 + Math.floor(rnd() * 2);
  for (let e = 0; e < edges; e++) {
    const j = Math.floor(rnd() * count);
    ctx.strokeStyle = colorAt(stops, lerp(0.2, 0.5, rnd()));
    ctx.globalAlpha = 0.6;
    ctx.moveTo(...nodes[i]); ctx.lineTo(...nodes[j]); ctx.stroke();
  }
}
for (const [x, y] of nodes) {
  const r = lerp(s * 0.02, s * 0.045, rnd());
  ctx.fillStyle = colorAt(stops, lerp(0.55, 1, rnd()));
  ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}`,
  },
  {
    name: 'scanline phosphor',
    summary: 'Flickering CRT scanlines with a handful of blinking cursor blocks.',
    math:
      "40 fixed horizontal scanlines run top to bottom, each with an independent per-frame flicker alpha (0.25–0.75) but a brightness that ramps smoothly with position — colorAt(stops, lerp(0.2, 0.7, row / 40)) — so the tile trends brighter toward the bottom even though every line's flicker is uncorrelated with its neighbors'. 3–6 cursor blocks are then dropped at random cells on a coarse 16×16 grid, each independently bright, like a CRT terminal with several blinking carets left on screen.",
    code:
`for (let i = 0; i < lineCount; i++) {
  ctx.globalAlpha = 0.25 + rnd() * 0.5;
  ctx.fillStyle = colorAt(stops, lerp(0.2, 0.7, i / lineCount));
  ctx.fillRect(0, i * lineH, s, lineH * 0.5);
}
for (let i = 0; i < cursors; i++) {
  const cx = Math.floor(rnd() * 14) * cell, cy = Math.floor(rnd() * 14) * cell;
  ctx.fillStyle = colorAt(stops, lerp(0.7, 1, rnd()));
  ctx.fillRect(cx, cy, cell * 0.8, cell * 1.4);
}`,
  },
];
