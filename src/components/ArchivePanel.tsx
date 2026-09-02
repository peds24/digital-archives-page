import type { ArchiveDetail } from '../lib/types';
import { toQueueTrack, randomIndex, type QueueTrack } from '../lib/nowPlaying';
import { TrackRow } from './TrackRow';

interface ArchivePanelProps {
  archive: ArchiveDetail;
  onClose: () => void;
  onPlayTrack: (queue: QueueTrack[], index: number) => void;
}

export function ArchivePanel({ archive, onClose, onPlayTrack }: ArchivePanelProps) {
  const queue = archive.tracks.filter((track) => !track.unavailable).map(toQueueTrack);

  function shuffle() {
    if (queue.length === 0) return;
    onPlayTrack(queue, randomIndex(queue.length));
  }

  return (
    <div className="archive-panel">
      <div className="archive-panel-header">
        <h2>Digital Archive #{String(archive.number).padStart(3, '0')}</h2>
        <div className="archive-panel-header-actions">
          <button type="button" onClick={shuffle} disabled={queue.length === 0}>shuffle</button>
          <a
            href={archive.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="spotify-glyph-link"
            aria-label="Open in Spotify"
            title="Open in Spotify"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M6.5 15.5c3-1 8-1 11 .8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M6.5 12c3.5-1.2 9-1.2 12.5.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M6.5 8.3c4-1.4 10.5-1.4 14.5.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </a>
          <button onClick={onClose}>close</button>
        </div>
      </div>
      <ol className="track-rows">
        {archive.tracks.map((track, i) => (
          <TrackRow
            key={track.id}
            name={track.name}
            artists={track.artists}
            unavailable={track.unavailable}
            badge={String(i + 1).padStart(2, '0')}
            onPlay={() => {
              const queueIndex = queue.findIndex((t) => t.id === track.id);
              if (queueIndex >= 0) onPlayTrack(queue, queueIndex);
            }}
          />
        ))}
      </ol>
    </div>
  );
}
