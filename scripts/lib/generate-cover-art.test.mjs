import { describe, it, expect } from 'vitest';
import { renderCoverArt, MAX_COVER_BYTES } from './generate-cover-art.mjs';

describe('renderCoverArt', () => {
  it('is deterministic for a given archive number (same seed/algorithm/stops)', () => {
    const a = renderCoverArt(3);
    const b = renderCoverArt(3);
    expect(a.equals(b)).toBe(true);
  });

  it('produces a different image for a different archive number', () => {
    const a = renderCoverArt(3);
    const b = renderCoverArt(4);
    expect(a.equals(b)).toBe(false);
  });

  it('produces a valid JPEG under the Spotify size limit', () => {
    const buf = renderCoverArt(1);
    // JPEG magic bytes (SOI marker)
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(buf.length).toBeLessThan(MAX_COVER_BYTES);
  });
});
