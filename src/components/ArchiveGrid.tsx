import type { ArchiveSummary } from '../lib/types';
import { ArchiveTile } from './ArchiveTile';

interface ArchiveGridProps {
  archives: ArchiveSummary[];
  selectedArchiveId: string | null;
  onSelect: (id: string) => void;
}

export function ArchiveGrid({ archives, selectedArchiveId, onSelect }: ArchiveGridProps) {
  if (archives.length === 0) {
    return <p className="archive-grid-empty">No archives match this filter.</p>;
  }
  return (
    <div className="archive-grid">
      {archives.map((archive) => (
        <ArchiveTile
          key={archive.id}
          archive={archive}
          selected={archive.id === selectedArchiveId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
