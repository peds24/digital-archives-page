import type { ArchiveDetail } from '../lib/types';
import { toQueueTrack, type QueueTrack } from '../lib/nowPlaying';
import { TrackRow } from './TrackRow';

interface ArchivePanelProps {
  archive: ArchiveDetail;
  onClose: () => void;
  onPlayTrack: (queue: QueueTrack[], index: number) => void;
}

export function ArchivePanel({ archive, onClose, onPlayTrack }: ArchivePanelProps) {
  const queue = archive.tracks.filter((track) => !track.unavailable).map(toQueueTrack);

  return (
    <div className="archive-panel">
      <div className="archive-panel-header">
        <h2>Digital Archive #{String(archive.number).padStart(3, '0')}</h2>
        <div className="archive-panel-header-actions">
          <a href={archive.spotifyUrl} target="_blank" rel="noreferrer">open in spotify ↗</a>
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
