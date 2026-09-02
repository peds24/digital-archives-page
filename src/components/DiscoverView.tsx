import { useState } from 'react';
import type { DiscoverableTrack } from '../lib/types';
import { discoverTracks } from '../lib/discoverTracks';
import { TrackRow } from './TrackRow';

interface DiscoverViewProps {
  trackPool: DiscoverableTrack[];
  onPlayTrack: (id: string) => void;
}

export function DiscoverView({ trackPool, onPlayTrack }: DiscoverViewProps) {
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
      <ul className="track-rows">
        {results.map((track) => (
          <TrackRow
            key={track.id}
            id={track.id}
            name={track.name}
            artists={track.artists}
            unavailable={track.unavailable}
            badge={`from #${String(track.archiveNumber).padStart(3, '0')}`}
            onPlay={onPlayTrack}
          />
        ))}
      </ul>
    </div>
  );
}
