import { useState } from 'react';
import type { DiscoverableTrack } from '../lib/types';
import { discoverTracks } from '../lib/discoverTracks';

interface DiscoveryPanelProps {
  trackPool: DiscoverableTrack[];
}

export function DiscoveryPanel({ trackPool }: DiscoveryPanelProps) {
  const [results, setResults] = useState<DiscoverableTrack[]>([]);

  function reroll() {
    setResults(discoverTracks(trackPool, 5));
  }

  return (
    <div className="discovery-panel">
      <h2>discover</h2>
      <button onClick={reroll}>reroll 5 songs</button>
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
  );
}
