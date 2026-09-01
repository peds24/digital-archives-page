import { useState } from 'react';
import { TILE_ALGORITHMS, DARK_STOPS, LIGHT_STOPS } from '../algorithms/tileAlgorithms';
import { ALGORITHM_INFO } from '../lib/algorithmInfo';
import { useTheme } from '../hooks/useTheme';
import { AlgorithmPreview } from './AlgorithmPreview';
import { Modal } from './Modal';

export function ArtView() {
  const { theme } = useTheme();
  const stops = theme === 'light' ? LIGHT_STOPS : DARK_STOPS;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null ? ALGORITHM_INFO[openIndex] : null;

  return (
    <div className="art-view">
      <p className="home-lede">
        Every archive's tile is generative Canvas art, not album artwork. The archive's number
        picks both the seed (so a given archive always renders the same way) and one of six
        algorithms below, round-robin. Every shape in every algorithm draws its color from the
        same six-stop ramp — the current theme's — so differentiation between tiles comes entirely
        from structure, never from an independent color choice.
      </p>
      <div className="algorithm-grid">
        {TILE_ALGORITHMS.map((algorithm, i) => (
          <div className="algorithm-card" key={ALGORITHM_INFO[i].name}>
            <AlgorithmPreview algorithm={algorithm} seed={i * 1000 + 7} stops={stops} />
            <div className="algorithm-card-meta">
              <h3>{ALGORITHM_INFO[i].name}</h3>
              <p>{ALGORITHM_INFO[i].summary}</p>
              <button type="button" onClick={() => setOpenIndex(i)}>details</button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal onClose={() => setOpenIndex(null)}>
          <div className="algorithm-modal">
            <div className="algorithm-modal-header">
              <h2>{open.name}</h2>
              <button type="button" onClick={() => setOpenIndex(null)}>close</button>
            </div>
            <p>{open.math}</p>
            <pre className="algorithm-code"><code>{open.code}</code></pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
