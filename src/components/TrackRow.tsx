interface TrackRowProps {
  name: string;
  artists: string[];
  unavailable: boolean;
  badge: string;
  onPlay: () => void;
}

export function TrackRow({ name, artists, unavailable, badge, onPlay }: TrackRowProps) {
  return (
    <li className={unavailable ? 'track-unavailable' : undefined}>
      <span>{name} — {artists.join(', ')}</span>
      <span className="track-badge">{badge}</span>
      {unavailable ? (
        <span>unavailable</span>
      ) : (
        <button type="button" className="track-play-btn" onClick={onPlay}>
          play
        </button>
      )}
    </li>
  );
}
