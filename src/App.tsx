import { useEffect, useState } from 'react';
import { loadAllArchives, type ArchiveLibrary } from './lib/loadArchives';
import { filterArchives } from './lib/filterArchives';
import { type ProgressFilter } from './components/FilterBar';
import { InfoTooltip } from './components/InfoTooltip';
import { AsciiNote } from './components/AsciiNote';
import { HomeView } from './components/HomeView';
import { ArchivesView } from './components/ArchivesView';
import { DiscoverView } from './components/DiscoverView';

const PERSONAL_SITE_URL = 'https://peds24.github.io/personal-website/';
const OWNER_NAME = 'pedro serdio hank';
const OWNER_EMAIL = 'serdiopedro@gmail.com';

export function App() {
  const [library, setLibrary] = useState<ArchiveLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'archives' | 'discover'>('home');
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
        <AsciiNote className="app-hero" cols={44} rows={36} />
        <div className="app-header-title">
          <h1>
            digital<span className="dot">.</span>archives
          </h1>
          <InfoTooltip />
        </div>
        <p>every 30 liked songs, sealed off.</p>
        <nav className="site-nav">
          <button
            className={view === 'home' ? 'active' : ''}
            onClick={() => setView('home')}
          >
            home
          </button>
          <button
            className={view === 'archives' ? 'active' : ''}
            onClick={() => setView('archives')}
          >
            archives
          </button>
          <button
            className={view === 'discover' ? 'active' : ''}
            onClick={() => setView('discover')}
          >
            discover
          </button>
          <a href={PERSONAL_SITE_URL}>personal website</a>
        </nav>
      </header>
      {view === 'home' && <HomeView archiveCount={library.archives.length} />}
      {view === 'archives' && (
        <ArchivesView
          archives={filteredArchives}
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
          selectedArchiveId={selectedArchiveId}
          selectedArchive={selectedArchive}
          onSelect={setSelectedArchiveId}
          onCloseSelected={() => setSelectedArchiveId(null)}
        />
      )}
      {view === 'discover' && <DiscoverView trackPool={library.trackPool} />}
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} {OWNER_NAME}</span>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>
      </footer>
    </main>
  );
}

export default App;
