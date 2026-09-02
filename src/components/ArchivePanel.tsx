import type { ArchiveDetail } from '../lib/types';
import { toQueueTrack, randomIndex, type QueueTrack } from '../lib/nowPlaying';
import { TrackRow } from './TrackRow';
import { SpotifyGlyph } from './SpotifyGlyph';

interface ArchivePanelProps {
  archive: ArchiveDetail;
  currentTrackId: string | null;
  onClose: () => void;
  onPlayTrack: (queue: QueueTrack[], index: number) => void;
}

export function ArchivePanel({ archive, currentTrackId, onClose, onPlayTrack }: ArchivePanelProps) {
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
            <SpotifyGlyph size={16} />
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
            active={track.id === currentTrackId}
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
