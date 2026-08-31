import { useEffect, useState } from 'react';
import { loadAllArchives, type ArchiveLibrary } from './lib/loadArchives';
import { FilterBar, type ProgressFilter } from './components/FilterBar';
import { ArchiveGrid } from './components/ArchiveGrid';
import { ArchivePanel } from './components/ArchivePanel';
import { DiscoveryPanel } from './components/DiscoveryPanel';

export function App() {
  const [library, setLibrary] = useState<ArchiveLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  useEffect(() => {
    loadAllArchives()
      .then(setLibrary)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="app-error">Couldn't load the archives: {error}</div>;
  if (!library) return <div className="app-loading">Loading archives…</div>;

  const filteredArchives = library.archives.filter((archive) => {
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

  const selectedArchive = selectedArchiveId
    ? library.archives.find((a) => a.id === selectedArchiveId) ?? null
    : null;

  return (
    <main className="app">
      <header className="app-header">
        <h1>digital archives</h1>
        <p>every 30 liked songs, sealed off.</p>
      </header>
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        progressFilter={progressFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onProgressFilterChange={setProgressFilter}
      />
      <ArchiveGrid archives={filteredArchives} onSelect={setSelectedArchiveId} />
      {selectedArchive && (
        <ArchivePanel archive={selectedArchive} onClose={() => setSelectedArchiveId(null)} />
      )}
      <DiscoveryPanel trackPool={library.trackPool} />
    </main>
  );
}

export default App;
