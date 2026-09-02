import type { Theme } from '../hooks/useTheme';

export type SpotifyMediaType = 'track' | 'playlist';

export interface NowPlayingTarget {
  type: SpotifyMediaType;
  id: string;
}

export function playlistIdFromUrl(spotifyUrl: string): string {
  const match = spotifyUrl.match(/\/playlist\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error(`Not a Spotify playlist URL: ${spotifyUrl}`);
  return match[1];
}

// theme=0 is the only theming knob Spotify's embed exposes — a darker,
// transparent-background chrome. There's no equivalent light-mode param, so
// the default (white) chrome is left alone when the site is in light mode.
export function buildEmbedSrc(target: NowPlayingTarget, theme: Theme): string {
  const params = new URLSearchParams({ utm_source: 'generator' });
  if (theme === 'dark') params.set('theme', '0');
  return `https://open.spotify.com/embed/${target.type}/${target.id}?${params.toString()}`;
}

export interface ResolveNowPlayingInput {
  overrideTrackId: string | null;
  openArchivePlaylistUrl: string | null;
  fallbackPlaylistUrl: string | null;
}

export function resolveNowPlaying({
  overrideTrackId,
  openArchivePlaylistUrl,
  fallbackPlaylistUrl,
}: ResolveNowPlayingInput): NowPlayingTarget | null {
  if (overrideTrackId) return { type: 'track', id: overrideTrackId };
  const playlistUrl = openArchivePlaylistUrl ?? fallbackPlaylistUrl;
  if (!playlistUrl) return null;
  return { type: 'playlist', id: playlistIdFromUrl(playlistUrl) };
}
