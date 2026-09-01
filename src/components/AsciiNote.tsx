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

function buildPoints(): Point[] {
  const pts: Point[] = [];

  // Notehead: tilted ellipsoid
  const rx = 1.0, ry = 0.72, rz = 0.62;
  const headY = -1.3;
  const tilt = -0.32;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let th = 0; th < Math.PI * 2; th += 0.07) {
    for (let ph = -Math.PI / 2; ph <= Math.PI / 2; ph += 0.07) {
      const lx = rx * Math.cos(ph) * Math.cos(th);
      const ly = ry * Math.sin(ph);
      const lz = rz * Math.cos(ph) * Math.sin(th);
      const x = lx * ct - ly * st;
      const y = lx * st + ly * ct;
      const z = lz;
      const nlx = (Math.cos(ph) * Math.cos(th)) / rx;
      const nly = Math.sin(ph) / ry;
      const nlz = (Math.cos(ph) * Math.sin(th)) / rz;
      const nx = nlx * ct - nly * st;
      const ny = nlx * st + nly * ct;
      const nz = nlz;
      const nlen = Math.hypot(nx, ny, nz) || 1;
      pts.push({ x, y: y + headY, z, nx: nx / nlen, ny: ny / nlen, nz: nz / nlen });
    }
  }

  // Stem
  const stemX = 0.82, stemR = 0.075;
  const stemBottom = headY + 0.1, stemTop = headY + 3.1;
  for (let h = stemBottom; h <= stemTop; h += 0.05) {
    for (let a = 0; a < Math.PI * 2; a += 0.35) {
      const cx = Math.cos(a), cz = Math.sin(a);
      pts.push({ x: stemX + stemR * cx, y: h, z: stemR * cz, nx: cx, ny: 0, nz: cz });
    }
  }

  // Flag (eighth-note wedge near the stem top)
  const fx = stemX + 0.28, fy = stemTop - 0.55, fz = 0;
  const frx = 0.5, fry = 0.62, frz = 0.4;
  for (let th2 = 0; th2 < Math.PI * 2; th2 += 0.11) {
    for (let ph2 = -Math.PI / 2; ph2 <= Math.PI / 2; ph2 += 0.11) {
      const lx2 = frx * Math.cos(ph2) * Math.cos(th2);
      const ly2 = fry * Math.sin(ph2);
      const lz2 = frz * Math.cos(ph2) * Math.sin(th2);
      if (lx2 < -0.1) continue;
      const nlen2 = Math.hypot(lx2 / frx, ly2 / fry, lz2 / frz) || 1;
      pts.push({
        x: fx + lx2, y: fy + ly2, z: fz + lz2,
        nx: (lx2 / frx) / nlen2, ny: (ly2 / fry) / nlen2, nz: (lz2 / frz) / nlen2,
      });
    }
  }

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

  const gridCols = cols ?? (narrow ? 40 : 64);
  const gridRows = rows ?? (narrow ? 34 : 52);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const K2 = 5;
    const kx = (gridCols * K2 * 3) / (8 * 3.2);
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
