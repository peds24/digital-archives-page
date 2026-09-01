import { useEffect, useState } from 'react';
import { loadAllArchives, type ArchiveLibrary } from './lib/loadArchives';
import { filterArchives } from './lib/filterArchives';
import { FilterBar, type ProgressFilter } from './components/FilterBar';
import { ArchiveGrid } from './components/ArchiveGrid';
import { ArchivePanel } from './components/ArchivePanel';
import { DiscoveryPanel } from './components/DiscoveryPanel';
import { InfoTooltip } from './components/InfoTooltip';

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

  const filteredArchives = filterArchives(library.archives, { dateFrom, dateTo, progressFilter });

  const selectedArchive = selectedArchiveId
    ? library.archives.find((a) => a.id === selectedArchiveId) ?? null
    : null;

  return (
    <main className="app">
      <header className="app-header">
        <div className="app-header-title">
          <h1>digital archives</h1>
          <InfoTooltip />
        </div>
        <p>every 30 liked songs, sealed off.</p>
      </header>
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        progressFilter={progressFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onProgressFilterChange={setProgressFilter}
        onClear={() => {
          setDateFrom('');
          setDateTo('');
          setProgressFilter('all');
        }}
      />
      <ArchiveGrid
        archives={filteredArchives}
        selectedArchiveId={selectedArchiveId}
        onSelect={setSelectedArchiveId}
      />
      {selectedArchive && (
        <ArchivePanel archive={selectedArchive} onClose={() => setSelectedArchiveId(null)} />
      )}
      <DiscoveryPanel trackPool={library.trackPool} />
    </main>
  );
}

export default App;
