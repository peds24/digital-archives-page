import { useState } from 'react';
import type { DiscoverableTrack } from '../lib/types';
import { discoverTracks } from '../lib/discoverTracks';
import { Modal } from './Modal';

interface DiscoveryPanelProps {
  trackPool: DiscoverableTrack[];
}

export function DiscoveryPanel({ trackPool }: DiscoveryPanelProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<DiscoverableTrack[]>([]);

  function reroll() {
    setResults(discoverTracks(trackPool, 5));
  }

  function openDiscovery() {
    reroll();
    setOpen(true);
  }

  return (
    <>
      <div className="discovery-trigger">
        <span>discover 5 random songs from across every archive</span>
        <button onClick={openDiscovery}>discover</button>
      </div>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="discovery-panel">
            <div className="discovery-panel-header">
              <h2>discover</h2>
              <button onClick={reroll}>reroll 5 songs</button>
            </div>
            <ul className="discovery-results">
              {results.map((track) => (
                <li key={track.id} className={track.unavailable ? 'track-unavailable' : undefined}>
                  <span>{track.name} — {track.artists.join(', ')}</span>
                  <span className="discovery-source">from #{String(track.archiveNumber).padStart(3, '0')}</span>
                  {track.unavailable ? (
                    <span>unavailable</span>
                  ) : (
                    <a href={track.spotifyUrl} target="_blank" rel="noreferrer">open ↗</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
}
