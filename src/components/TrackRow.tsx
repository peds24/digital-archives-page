import { SpotifyGlyph } from './SpotifyGlyph';

interface TrackRowProps {
  name: string;
  artists: string[];
  unavailable: boolean;
  active: boolean;
  badge: string;
  spotifyUrl?: string;
  onPlay: () => void;
}

export function TrackRow({ name, artists, unavailable, active, badge, spotifyUrl, onPlay }: TrackRowProps) {
  const classes = [unavailable && 'track-unavailable', active && 'track-active'].filter(Boolean).join(' ') || undefined;

  return (
    <li className={classes}>
      <span>{active && '▶ '}{name} — {artists.join(', ')}</span>
      <span className="track-badge">{badge}</span>
      {unavailable ? (
        <span>unavailable</span>
      ) : (
        <span className="track-actions">
          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="spotify-glyph-link"
              aria-label="Save on Spotify"
              title="Save on Spotify"
            >
              <SpotifyGlyph size={14} />
            </a>
          )}
          <button type="button" className="track-play-btn" onClick={onPlay}>
            play
          </button>
        </span>
      )}
    </li>
  );
}
