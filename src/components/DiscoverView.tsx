import { useState } from 'react';
import type { DiscoverableTrack } from '../lib/types';
import { discoverTracks } from '../lib/discoverTracks';

interface DiscoverViewProps {
  trackPool: DiscoverableTrack[];
}

export function DiscoverView({ trackPool }: DiscoverViewProps) {
  const [results, setResults] = useState<DiscoverableTrack[]>(() => discoverTracks(trackPool, 5));

  function reroll() {
    setResults(discoverTracks(trackPool, 5));
  }

  return (
    <div className="discover-view">
      <div className="discover-view-header">
        <p>five random songs pulled from across every archive</p>
        <button onClick={reroll}>shuffle</button>
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
  );
}
