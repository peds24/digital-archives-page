import type { ArchiveSummary } from './types';
import type { ProgressFilter } from '../components/FilterBar';

export interface ArchiveFilters {
  dateFrom: string;
  dateTo: string;
  progressFilter: ProgressFilter;
}

export function filterArchives(
  archives: ArchiveSummary[],
  { dateFrom, dateTo, progressFilter }: ArchiveFilters
): ArchiveSummary[] {
  return archives.filter((archive) => {
    if (progressFilter === 'inProgress' && !archive.inProgress) return false;
    if (progressFilter === 'complete' && archive.inProgress) return false;
    // ISO date strings from the API include a time component (e.g. "2026-04-29T17:58:28Z");
    // slice to the date-only prefix before comparing against a plain "YYYY-MM-DD" <input type=date>
    // value, or same-day archives get incorrectly excluded by a naive full-string compare.
    const latestDate = archive.dateRange.latest?.slice(0, 10);
    const earliestDate = archive.dateRange.earliest?.slice(0, 10);
    if (dateFrom && latestDate && latestDate < dateFrom) return false;
    if (dateTo && earliestDate && earliestDate > dateTo) return false;
    return true;
  });
}
