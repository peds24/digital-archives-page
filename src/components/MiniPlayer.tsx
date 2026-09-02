import type { Theme } from '../hooks/useTheme';
import { buildEmbedSrc, type NowPlayingTarget } from '../lib/spotifyEmbed';

interface MiniPlayerProps {
  target: NowPlayingTarget | null;
  theme: Theme;
}

export function MiniPlayer({ target, theme }: MiniPlayerProps) {
  if (!target) return null;
  const src = buildEmbedSrc(target, theme);

  return (
    <div className="mini-player">
      <iframe
        key={src}
        title="Spotify miniplayer"
        src={src}
        width="100%"
        height={80}
        style={{ border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
