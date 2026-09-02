import { useState } from 'react';
import type { DiscoverableTrack } from '../lib/types';
import { discoverTracks } from '../lib/discoverTracks';
import { toQueueTrack, type QueueTrack } from '../lib/nowPlaying';
import { TrackRow } from './TrackRow';

interface DiscoverViewProps {
  trackPool: DiscoverableTrack[];
  currentTrackId: string | null;
  onPlayTrack: (queue: QueueTrack[], index: number) => void;
}

export function DiscoverView({ trackPool, currentTrackId, onPlayTrack }: DiscoverViewProps) {
  const [results, setResults] = useState<DiscoverableTrack[]>(() => discoverTracks(trackPool, 5));

  function reroll() {
    setResults(discoverTracks(trackPool, 5));
  }

  const queue = results.filter((track) => !track.unavailable).map(toQueueTrack);

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
            name={track.name}
            artists={track.artists}
            unavailable={track.unavailable}
            active={track.id === currentTrackId}
            badge={`from #${String(track.archiveNumber).padStart(3, '0')}`}
            spotifyUrl={track.spotifyUrl}
            onPlay={() => {
              const queueIndex = queue.findIndex((t) => t.id === track.id);
              if (queueIndex >= 0) onPlayTrack(queue, queueIndex);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
