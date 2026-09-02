import type { ArchiveDetail } from '../lib/types';
import { Modal } from './Modal';
import { TrackRow } from './TrackRow';

interface ArchivePanelProps {
  archive: ArchiveDetail;
  onClose: () => void;
  onPlayTrack: (id: string) => void;
}

export function ArchivePanel({ archive, onClose, onPlayTrack }: ArchivePanelProps) {
  return (
    <Modal onClose={onClose}>
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
              id={track.id}
              name={track.name}
              artists={track.artists}
              unavailable={track.unavailable}
              badge={String(i + 1).padStart(2, '0')}
              onPlay={onPlayTrack}
            />
          ))}
        </ol>
      </div>
    </Modal>
  );
}
