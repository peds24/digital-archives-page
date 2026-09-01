import { useEffect, useRef, useState } from 'react';

const RAMP = '.,-~:;=!*#$@';
const SPEED = 0.5; // radians per second, vertical-axis only
const START_ANGLE = 0.6;

const NARROW = '(max-width: 40rem)';

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', on);
    setNarrow(mq.matches);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

interface Point {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
}

// Notehead: tilted ellipsoid (one per note).
function makeNotehead(pts: Point[], cx: number, cy: number) {
  const rx = 0.62, ry = 0.44, rz = 0.39;
  const tilt = -0.32;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let th = 0; th < Math.PI * 2; th += 0.055) {
    for (let ph = -Math.PI / 2; ph <= Math.PI / 2; ph += 0.055) {
      const lx = rx * Math.cos(ph) * Math.cos(th);
      const ly = ry * Math.sin(ph);
      const lz = rz * Math.cos(ph) * Math.sin(th);
      const x = lx * ct - ly * st;
      const y = lx * st + ly * ct;
      const nlx = (Math.cos(ph) * Math.cos(th)) / rx;
      const nly = Math.sin(ph) / ry;
      const nlz = (Math.cos(ph) * Math.sin(th)) / rz;
      const nx = nlx * ct - nly * st;
      const ny = nlx * st + nly * ct;
      const nlen = Math.hypot(nx, ny, nlz) || 1;
      pts.push({ x: cx + x, y: cy + y, z: lz, nx: nx / nlen, ny: ny / nlen, nz: nlz / nlen });
    }
  }
}

// Stem: a thin vertical cylinder running from a note's head up to the beam.
function makeStem(pts: Point[], x: number, yBottom: number, yTop: number) {
  const r = 0.075;
  for (let h = yBottom; h <= yTop; h += 0.035) {
    for (let a = 0; a < Math.PI * 2; a += 0.28) {
      const cx = Math.cos(a), cz = Math.sin(a);
      pts.push({ x: x + r * cx, y: h, z: r * cz, nx: cx, ny: 0, nz: cz });
    }
  }
}

// Beam: a flat level slab connecting the two stem tops.
function makeBeam(pts: Point[], x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const upX = -dy / len, upY = dx / len;
  const thickness = 0.16, depth = 0.14;
  for (let t = 0; t <= 1; t += 0.014) {
    const cx = x1 + dx * t, cy = y1 + dy * t;
    for (let w = -thickness; w <= thickness; w += thickness) {
      for (let z = -depth; z <= depth; z += depth) {
        if (w === 0 && z === 0) continue;
        const isTop = w > 0;
        const isFront = z > 0;
        const nx = isTop ? upX : -upX;
        const ny = isTop ? upY : -upY;
        const nz = isFront ? 1 : z < 0 ? -1 : 0;
        pts.push({ x: cx + upX * w, y: cy + upY * w, z, nx, ny, nz });
      }
    }
  }
}

// A beamed eighth-note pair: two noteheads, two stems, and a
// level connecting beam bar (like the glyph ♫).
function buildPoints(): Point[] {
  const pts: Point[] = [];
  const headYL = -1.3, headYR = -1.55;
  const stemXL = -0.47, stemXR = 1.53;
  const beamY = 1.75;
  const beamYL = beamY, beamYR = beamY;

  makeNotehead(pts, -1.0, headYL);
  makeNotehead(pts, 1.0, headYR);
  makeStem(pts, stemXL, headYL + 0.1, beamYL);
  makeStem(pts, stemXR, headYR + 0.1, beamYR);
  makeBeam(pts, stemXL, beamYL, stemXR, beamYR);

  return pts;
}

const POINTS = buildPoints();

interface Props {
  cols?: number;
  rows?: number;
  className?: string;
}

export function AsciiNote({ cols, rows, className = '' }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  const narrow = useNarrow();

  const gridCols = cols ?? (narrow ? 40 : 88);
  const gridRows = rows ?? (narrow ? 34 : 72);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const K2 = 5;
    const kx = (gridCols * K2 * 3) / (8 * 4.6);
    const ky = kx * 0.5;

    const zbuf = new Float32Array(gridCols * gridRows);
    const out = new Array<string>(gridCols * gridRows);

    let lightX = 0.4, lightY = 0.3, lightZ = -0.9;
    const llen = Math.hypot(lightX, lightY, lightZ);
    lightX /= llen; lightY /= llen; lightZ /= llen;

    const draw = (b: number) => {
      zbuf.fill(0);
      out.fill(' ');
      const cB = Math.cos(b), sB = Math.sin(b);

      for (let i = 0; i < POINTS.length; i++) {
        const p = POINTS[i];
        const x = p.x * cB + p.z * sB;
        const z = -p.x * sB + p.z * cB + K2;
        const y = p.y;
        const nx = p.nx * cB + p.nz * sB;
        const nz = -p.nx * sB + p.nz * cB;
        const ny = p.ny;

        const ooz = 1 / z;
        const xp = Math.trunc(gridCols / 2 + kx * ooz * x);
        const yp = Math.trunc(gridRows / 2 - ky * ooz * y);
        if (xp < 0 || xp >= gridCols || yp < 0 || yp >= gridRows) continue;

        const idx = xp + gridCols * yp;
        if (ooz <= zbuf[idx]) continue;
        zbuf[idx] = ooz;

        let lum = nx * lightX + ny * lightY + nz * lightZ;
        if (lum < 0) lum = 0;
        const ci = Math.trunc(lum * (RAMP.length - 1));
        out[idx] = RAMP[Math.min(Math.max(ci, 0), RAMP.length - 1)];
      }

      let s = '';
      for (let r = 0; r < gridRows; r++) {
        s += out.slice(r * gridCols, r * gridCols + gridCols).join('') + '\n';
      }
      el.textContent = s;
    };

    draw(START_ANGLE);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    let raf = 0;
    let start = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      elapsed = (now - start) / 1000;
      draw(START_ANGLE + elapsed * SPEED);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        start = performance.now() - elapsed * 1000;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [gridCols, gridRows]);

  return <pre ref={ref} className={`ascii-note ${className}`} aria-hidden="true" />;
}
