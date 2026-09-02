import { useEffect, useRef, useState } from 'react';
import { loadAllArchives, type ArchiveLibrary } from './lib/loadArchives';
import { filterArchives } from './lib/filterArchives';
import { toQueueTrack } from './lib/nowPlaying';
import { useNowPlaying } from './hooks/useNowPlaying';
import { type ProgressFilter } from './components/FilterBar';
import { ThemeToggle } from './components/ThemeToggle';
import { AsciiNote } from './components/AsciiNote';
import { HomeView } from './components/HomeView';
import { ArchivesView } from './components/ArchivesView';
import { DiscoverView } from './components/DiscoverView';
import { ArtView } from './components/ArtView';
import { NowPlayingBar } from './components/NowPlayingBar';

const PERSONAL_SITE_URL = 'https://peds24.github.io/personal-website/';
const OWNER_NAME = 'pedro serdio hank';
const OWNER_EMAIL = 'serdiopedro@gmail.com';

export function App() {
  const [library, setLibrary] = useState<ArchiveLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'archives' | 'discover' | 'art'>('home');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [navWidth, setNavWidth] = useState<number | null>(null);

  useEffect(() => {
    loadAllArchives()
      .then(setLibrary)
      .catch((err: Error) => setError(err.message));
  }, []);

  // The now-playing bar is capped to the width the nav tabs span, not the
  // full page — measured live since that width depends on font/text layout.
  // Depends on `library`, not []: the <nav> this observes doesn't exist yet
  // on App's first render (still showing "Loading archives…"), so an
  // effect that only ever ran once would find navRef.current null and never
  // get another chance to attach the observer.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setNavWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [library]);

  const mostRecentArchive = library
    ? library.archives.reduce<ArchiveLibrary['archives'][number] | null>(
        (latest, archive) => (!latest || archive.number > latest.number ? archive : latest),
        null
      )
    : null;

  const initialTracks = mostRecentArchive
    ? mostRecentArchive.tracks.filter((track) => !track.unavailable).map(toQueueTrack)
    : [];

  const nowPlaying = useNowPlaying(initialTracks);

  if (error) return <div className="app-error">Couldn't load the archives: {error}</div>;
  if (!library) return <div className="app-loading">Loading archives…</div>;

  const filteredArchives = filterArchives(library.archives, { dateFrom, dateTo, progressFilter });

  const selectedArchive = selectedArchiveId
    ? library.archives.find((a) => a.id === selectedArchiveId) ?? null
    : null;

  function selectArchive(id: string) {
    setSelectedArchiveId(id);
    const archive = library!.archives.find((a) => a.id === id);
    if (!archive) return;
    const tracks = archive.tracks.filter((track) => !track.unavailable).map(toQueueTrack);
    if (tracks.length) nowPlaying.playQueue(tracks, 0, { autoplay: false });
  }

  return (
    <main className="app">
      <ThemeToggle />
      <header className="app-header">
        <AsciiNote className="app-hero" cols={44} rows={36} />
        <div className="app-header-title">
          <h1>
            digital<span className="dot">.</span>archives
          </h1>
        </div>
        <p>every 30 liked songs, sealed off.</p>
        <nav className="site-nav" ref={navRef}>
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
          <button
            className={view === 'art' ? 'active' : ''}
            onClick={() => setView('art')}
          >
            art
          </button>
          <a href={PERSONAL_SITE_URL}>personal website</a>
        </nav>
      </header>
      <NowPlayingBar player={nowPlaying} maxWidth={navWidth} />
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
          onSelect={selectArchive}
          onCloseSelected={() => setSelectedArchiveId(null)}
          onPlayTrack={(queue, index) => nowPlaying.playQueue(queue, index, { autoplay: true })}
        />
      )}
      {view === 'discover' && (
        <DiscoverView
          trackPool={library.trackPool}
          onPlayTrack={(queue, index) => nowPlaying.playQueue(queue, index, { autoplay: true })}
        />
      )}
      {view === 'art' && <ArtView />}
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} {OWNER_NAME}</span>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>
      </footer>
    </main>
  );
}

export default App;
