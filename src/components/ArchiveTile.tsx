import { useEffect, useRef } from 'react';
import { mulberry32 } from '../algorithms/rng';
import { TILE_ALGORITHMS, type DrawContext } from '../algorithms/tileAlgorithms';
import type { ArchiveSummary } from '../lib/types';

interface ArchiveTileProps {
  archive: ArchiveSummary;
  onSelect: (id: string) => void;
}

export function ArchiveTile({ archive, onSelect }: ArchiveTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth || 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const rnd = mulberry32(archive.number * 1000 + 7);
    const algorithm = TILE_ALGORITHMS[archive.number % TILE_ALGORITHMS.length];
    algorithm(ctx as unknown as DrawContext, size, rnd);
  }, [archive]);

  return (
    <button className="archive-tile" onClick={() => onSelect(archive.id)}>
      <canvas ref={canvasRef} />
      <div className="archive-tile-meta">
        <span>#{String(archive.number).padStart(3, '0')}</span>
        <span>{archive.trackCount} tracks{archive.inProgress ? ' · in progress' : ''}</span>
      </div>
    </button>
  );
}
