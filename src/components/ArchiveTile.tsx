import { useEffect, useRef } from 'react';
import { TILE_ALGORITHMS, DARK_STOPS, LIGHT_STOPS } from '../algorithms/tileAlgorithms';
import { useTheme } from '../hooks/useTheme';
import { drawTile } from '../lib/drawTile';
import type { ArchiveSummary } from '../lib/types';

interface ArchiveTileProps {
  archive: ArchiveSummary;
  selected?: boolean;
  onSelect: (id: string) => void;
}

export function ArchiveTile({ archive, selected = false, onSelect }: ArchiveTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const algorithm = TILE_ALGORITHMS[archive.number % TILE_ALGORITHMS.length];
    const stops = theme === 'light' ? LIGHT_STOPS : DARK_STOPS;
    drawTile(canvas, algorithm, archive.number * 1000 + 7, stops);
  }, [archive, theme]);

  return (
    <button
      className={`archive-tile${selected ? ' selected' : ''}`}
      onClick={() => onSelect(archive.id)}
    >
      <canvas ref={canvasRef} />
      <div className="archive-tile-meta">
        <span>#{String(archive.number).padStart(3, '0')}</span>
        <span>{archive.trackCount} tracks{archive.inProgress ? ' · in progress' : ''}</span>
      </div>
    </button>
  );
}
