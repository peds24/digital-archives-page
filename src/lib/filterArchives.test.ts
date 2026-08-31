import { describe, it, expect } from 'vitest';
import { filterArchives } from './filterArchives';
import type { ArchiveSummary } from './types';

function archive(overrides: Partial<ArchiveSummary> = {}): ArchiveSummary {
  return {
    id: 'archive-001',
    number: 1,
    trackCount: 30,
    inProgress: false,
    dateRange: { earliest: '2024-01-01T00:00:00Z', latest: '2024-01-10T00:00:00Z' },
    ...overrides,
  };
}

describe('filterArchives', () => {
  it('returns everything when no filters are set', () => {
    const archives = [archive({ id: 'a' }), archive({ id: 'b', inProgress: true })];
    const result = filterArchives(archives, { dateFrom: '', dateTo: '', progressFilter: 'all' });
    expect(result.map((a) => a.id)).toEqual(['a', 'b']);
  });

  describe('progressFilter', () => {
    const complete = archive({ id: 'complete', inProgress: false });
    const inProgress = archive({ id: 'in-progress', inProgress: true });

    it('"all" keeps both complete and in-progress archives', () => {
      const result = filterArchives([complete, inProgress], { dateFrom: '', dateTo: '', progressFilter: 'all' });
      expect(result.map((a) => a.id)).toEqual(['complete', 'in-progress']);
    });

    it('"inProgress" keeps only in-progress archives', () => {
      const result = filterArchives([complete, inProgress], {
        dateFrom: '',
        dateTo: '',
        progressFilter: 'inProgress',
      });
      expect(result.map((a) => a.id)).toEqual(['in-progress']);
    });

    it('"complete" keeps only complete archives', () => {
      const result = filterArchives([complete, inProgress], {
        dateFrom: '',
        dateTo: '',
        progressFilter: 'complete',
      });
      expect(result.map((a) => a.id)).toEqual(['complete']);
    });
  });

  describe('dateFrom (lower bound on the archive\'s latest date)', () => {
    it('excludes an archive whose latest date is before dateFrom', () => {
      const a = archive({ id: 'a', dateRange: { earliest: '2024-01-01T00:00:00Z', latest: '2024-01-05T00:00:00Z' } });
      const result = filterArchives([a], { dateFrom: '2024-01-06', dateTo: '', progressFilter: 'all' });
      expect(result).toEqual([]);
    });

    it('includes an archive whose latest date is on or after dateFrom', () => {
      const a = archive({ id: 'a', dateRange: { earliest: '2024-01-01T00:00:00Z', latest: '2024-01-06T00:00:00Z' } });
      const result = filterArchives([a], { dateFrom: '2024-01-06', dateTo: '', progressFilter: 'all' });
      expect(result.map((x) => x.id)).toEqual(['a']);
    });
  });

  describe('dateTo (upper bound on the archive\'s earliest date)', () => {
    it('excludes an archive whose earliest date is after dateTo', () => {
      const a = archive({ id: 'a', dateRange: { earliest: '2024-01-10T00:00:00Z', latest: '2024-01-12T00:00:00Z' } });
      const result = filterArchives([a], { dateFrom: '', dateTo: '2024-01-09', progressFilter: 'all' });
      expect(result).toEqual([]);
    });

    it('includes an archive whose earliest date is on or before dateTo', () => {
      const a = archive({ id: 'a', dateRange: { earliest: '2024-01-09T00:00:00Z', latest: '2024-01-12T00:00:00Z' } });
      const result = filterArchives([a], { dateFrom: '', dateTo: '2024-01-09', progressFilter: 'all' });
      expect(result.map((x) => x.id)).toEqual(['a']);
    });

    it('same-day edge case: a same-day archive (earliest === latest) is not excluded by a naive full ISO-string compare', () => {
      // earliest and latest share the same date but differ in time-of-day; date-to should
      // still include it when the date-only prefix matches, not exclude it via a raw string compare.
      const a = archive({
        id: 'same-day',
        dateRange: { earliest: '2024-04-29T17:58:28Z', latest: '2024-04-29T21:10:00Z' },
      });
      const result = filterArchives([a], { dateFrom: '', dateTo: '2024-04-29', progressFilter: 'all' });
      expect(result.map((x) => x.id)).toEqual(['same-day']);
    });
  });

  it('combines dateFrom, dateTo, and progressFilter (AND semantics)', () => {
    const inRange = archive({
      id: 'in-range',
      inProgress: true,
      dateRange: { earliest: '2024-05-01T00:00:00Z', latest: '2024-05-05T00:00:00Z' },
    });
    const outOfRange = archive({
      id: 'out-of-range',
      inProgress: true,
      dateRange: { earliest: '2024-01-01T00:00:00Z', latest: '2024-01-05T00:00:00Z' },
    });
    const wrongProgress = archive({
      id: 'wrong-progress',
      inProgress: false,
      dateRange: { earliest: '2024-05-01T00:00:00Z', latest: '2024-05-05T00:00:00Z' },
    });

    const result = filterArchives([inRange, outOfRange, wrongProgress], {
      dateFrom: '2024-04-01',
      dateTo: '2024-06-01',
      progressFilter: 'inProgress',
    });

    expect(result.map((a) => a.id)).toEqual(['in-range']);
  });

  it('treats null dateRange values as unbounded (never excludes on a missing date)', () => {
    const a = archive({ id: 'a', dateRange: { earliest: null, latest: null } });
    const result = filterArchives([a], { dateFrom: '2024-01-01', dateTo: '2024-12-31', progressFilter: 'all' });
    expect(result.map((x) => x.id)).toEqual(['a']);
  });
});
