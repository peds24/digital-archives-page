interface TrackRowProps {
  name: string;
  artists: string[];
  unavailable: boolean;
  active: boolean;
  badge: string;
  onPlay: () => void;
}

export function TrackRow({ name, artists, unavailable, active, badge, onPlay }: TrackRowProps) {
  const classes = [unavailable && 'track-unavailable', active && 'track-active'].filter(Boolean).join(' ') || undefined;

  return (
    <li className={classes}>
      <span>{active && '▶ '}{name} — {artists.join(', ')}</span>
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
