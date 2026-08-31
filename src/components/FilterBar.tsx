export type ProgressFilter = 'all' | 'inProgress' | 'complete';

interface FilterBarProps {
  dateFrom: string;
  dateTo: string;
  progressFilter: ProgressFilter;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onProgressFilterChange: (value: ProgressFilter) => void;
}

export function FilterBar({
  dateFrom,
  dateTo,
  progressFilter,
  onDateFromChange,
  onDateToChange,
  onProgressFilterChange,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <label>
        from
        <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
      </label>
      <label>
        to
        <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
      </label>
      <select
        value={progressFilter}
        onChange={(e) => onProgressFilterChange(e.target.value as ProgressFilter)}
      >
        <option value="all">all archives</option>
        <option value="inProgress">in progress only</option>
        <option value="complete">complete only</option>
      </select>
    </div>
  );
}
