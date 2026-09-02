interface TrackRowProps {
  id: string;
  name: string;
  artists: string[];
  unavailable: boolean;
  badge: string;
  onPlay: (id: string) => void;
}

export function TrackRow({ id, name, artists, unavailable, badge, onPlay }: TrackRowProps) {
  return (
    <li className={unavailable ? 'track-unavailable' : undefined}>
      <span>{name} — {artists.join(', ')}</span>
      <span className="track-badge">{badge}</span>
      {unavailable ? (
        <span>unavailable</span>
      ) : (
        <button type="button" className="track-play-btn" onClick={() => onPlay(id)}>
          play
        </button>
      )}
    </li>
  );
}
