import { createCanvas } from 'canvas';
import { TILE_ALGORITHMS, DARK_STOPS, LIGHT_STOPS } from '../../src/algorithms/tileAlgorithms.ts';
import { mulberry32 } from '../../src/algorithms/rng.ts';

// Spotify's cover-image upload rejects anything over 256KB.
export const MAX_COVER_BYTES = 256 * 1024;

// Mirrors ArchiveTile.tsx's algorithm/seed/stops selection exactly, so the
// uploaded Spotify cover matches what the archive page renders for that tile.
export function renderCoverArt(archiveNumber, { theme = 'dark', size = 1000, quality = 0.85 } = {}) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const algorithm = TILE_ALGORITHMS[archiveNumber % TILE_ALGORITHMS.length];
  const stops = theme === 'light' ? LIGHT_STOPS : DARK_STOPS;
  const rnd = mulberry32(archiveNumber * 1000 + 7);
  algorithm(ctx, size, rnd, stops);
  const buffer = canvas.toBuffer('image/jpeg', { quality });
  if (buffer.length > MAX_COVER_BYTES) {
    throw new Error(
      `Rendered cover for archive #${archiveNumber} is ${buffer.length} bytes, over Spotify's ${MAX_COVER_BYTES}-byte limit`
    );
  }
  return buffer;
}
