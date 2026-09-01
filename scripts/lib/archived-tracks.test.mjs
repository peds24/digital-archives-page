import { describe, it, expect } from 'vitest';
import { collectArchivedTrackIds } from './archived-tracks.mjs';

describe('collectArchivedTrackIds', () => {
  it('collects track ids across all archives, excluding unavailable placeholders', () => {
    const archives = [
      { tracks: [{ id: 't1', unavailable: false }, { id: 'archive-001-unavailable-3', unavailable: true }] },
      { tracks: [{ id: 't2', unavailable: false }] },
    ];
    expect(collectArchivedTrackIds(archives)).toEqual(new Set(['t1', 't2']));
  });

  it('returns an empty set for no archives', () => {
    expect(collectArchivedTrackIds([])).toEqual(new Set());
  });
});
