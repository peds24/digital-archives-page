import type { ArchiveSummary, ArchiveDetail } from '../lib/types';
import { FilterBar, type ProgressFilter } from './FilterBar';
import { ArchiveGrid } from './ArchiveGrid';
import { ArchivePanel } from './ArchivePanel';

interface ArchivesViewProps {
  archives: ArchiveSummary[];
  dateFrom: string;
  dateTo: string;
  progressFilter: ProgressFilter;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onProgressFilterChange: (value: ProgressFilter) => void;
  onClear: () => void;
  selectedArchiveId: string | null;
  selectedArchive: ArchiveDetail | null;
  onSelect: (id: string) => void;
  onCloseSelected: () => void;
}

export function ArchivesView({
  archives, dateFrom, dateTo, progressFilter,
  onDateFromChange, onDateToChange, onProgressFilterChange, onClear,
  selectedArchiveId, selectedArchive, onSelect, onCloseSelected,
}: ArchivesViewProps) {
  return (
    <div className="archives-view">
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        progressFilter={progressFilter}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onProgressFilterChange={onProgressFilterChange}
        onClear={onClear}
      />
      <ArchiveGrid
        archives={archives}
        selectedArchiveId={selectedArchiveId}
        onSelect={onSelect}
      />
      {selectedArchive && (
        <ArchivePanel archive={selectedArchive} onClose={onCloseSelected} />
      )}
    </div>
  );
}
