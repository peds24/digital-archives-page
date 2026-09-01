import { useRef } from 'react';
import type { ArchiveSummary } from '../lib/types';
import { ArchiveTile } from './ArchiveTile';

interface ArchiveGridProps {
  archives: ArchiveSummary[];
  selectedArchiveId: string | null;
  onSelect: (id: string) => void;
}

export function ArchiveGrid({ archives, selectedArchiveId, onSelect }: ArchiveGridProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByTile(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const tileWidth = track.querySelector('.archive-tile')?.clientWidth ?? 240;
    track.scrollBy({ left: direction * (tileWidth + 18), behavior: 'smooth' });
  }

  if (archives.length === 0) {
    return <p className="archive-grid-empty">No archives match this filter.</p>;
  }

  return (
    <div className="archive-carousel">
      <button
        className="archive-carousel-nav archive-carousel-nav-prev"
        onClick={() => scrollByTile(-1)}
        aria-label="Scroll to previous archives"
      >
        ‹
      </button>
      <div className="archive-carousel-track" ref={trackRef}>
        {archives.map((archive) => (
          <ArchiveTile
            key={archive.id}
            archive={archive}
            selected={archive.id === selectedArchiveId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <button
        className="archive-carousel-nav archive-carousel-nav-next"
        onClick={() => scrollByTile(1)}
        aria-label="Scroll to next archives"
      >
        ›
      </button>
    </div>
  );
}
