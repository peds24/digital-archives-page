import { useEffect, useRef } from 'react';
import type { DrawFn } from '../algorithms/tileAlgorithms';
import { drawTile } from '../lib/drawTile';

interface AlgorithmPreviewProps {
  algorithm: DrawFn;
  seed: number;
  stops: string[];
}

export function AlgorithmPreview({ algorithm, seed, stops }: AlgorithmPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawTile(canvas, algorithm, seed, stops);
  }, [algorithm, seed, stops]);

  return <canvas ref={canvasRef} className="algorithm-preview" />;
}
