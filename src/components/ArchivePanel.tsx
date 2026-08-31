import type { ArchiveDetail } from '../lib/types';

interface ArchivePanelProps {
  archive: ArchiveDetail;
  onClose: () => void;
}

export function ArchivePanel({ archive, onClose }: ArchivePanelProps) {
  return (
    <div className="archive-panel">
      <div className="archive-panel-header">
        <h2>Digital Archive #{String(archive.number).padStart(3, '0')}</h2>
        <button onClick={onClose}>close</button>
      </div>
      <ol className="archive-tracklist">
        {archive.tracks.map((track) => (
          <li key={track.id}>
            <span>{track.name} — {track.artists.join(', ')}</span>
            <a href={track.spotifyUrl} target="_blank" rel="noreferrer">open ↗</a>
          </li>
        ))}
      </ol>
    </div>
  );
}
