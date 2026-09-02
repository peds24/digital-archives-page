import { describe, it, expect } from 'vitest';
import { buildDateRangeDescription } from './archive-description.mjs';

describe('buildDateRangeDescription', () => {
  it('formats the earliest and latest addedAt as "Mon D, YYYY – Mon D, YYYY"', () => {
    const tracks = [
      { addedAt: '2026-02-14T10:00:00Z' },
      { addedAt: '2026-01-03T08:00:00Z' },
      { addedAt: '2026-01-20T12:00:00Z' },
    ];
    expect(buildDateRangeDescription(tracks)).toBe('Jan 3, 2026 – Feb 14, 2026');
  });

  it('uses the same date twice when there is only one track', () => {
    const tracks = [{ addedAt: '2026-03-05T00:00:00Z' }];
    expect(buildDateRangeDescription(tracks)).toBe('Mar 5, 2026 – Mar 5, 2026');
  });

  it('does not assume input order — sorts by addedAt before picking endpoints', () => {
    const tracks = [
      { addedAt: '2026-06-01T00:00:00Z' },
      { addedAt: '2026-01-01T00:00:00Z' },
      { addedAt: '2026-12-31T00:00:00Z' },
      { addedAt: '2026-03-15T00:00:00Z' },
    ];
    expect(buildDateRangeDescription(tracks)).toBe('Jan 1, 2026 – Dec 31, 2026');
  });
});
