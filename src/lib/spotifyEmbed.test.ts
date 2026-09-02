import { describe, it, expect } from 'vitest';
import { playlistIdFromUrl, buildEmbedSrc, resolveNowPlaying } from './spotifyEmbed';

describe('playlistIdFromUrl', () => {
  it('extracts the playlist id from a Spotify playlist URL', () => {
    expect(playlistIdFromUrl('https://open.spotify.com/playlist/7v7QNct1FXJkJuTdH2LZTQ')).toBe(
      '7v7QNct1FXJkJuTdH2LZTQ'
    );
  });

  it('throws for a URL with no playlist segment', () => {
    expect(() => playlistIdFromUrl('https://open.spotify.com/track/4qS2KPWvsQzLvRa9oCHw41')).toThrow();
  });
});

describe('buildEmbedSrc', () => {
  it('builds a playlist embed URL', () => {
    const src = buildEmbedSrc({ type: 'playlist', id: 'abc123' }, 'dark');
    expect(src).toBe('https://open.spotify.com/embed/playlist/abc123?utm_source=generator&theme=0');
  });

  it('builds a track embed URL', () => {
    const src = buildEmbedSrc({ type: 'track', id: 'xyz789' }, 'dark');
    expect(src).toBe('https://open.spotify.com/embed/track/xyz789?utm_source=generator&theme=0');
  });

  it('omits the theme param in light mode, since Spotify has no light embed chrome', () => {
    const src = buildEmbedSrc({ type: 'playlist', id: 'abc123' }, 'light');
    expect(src).toBe('https://open.spotify.com/embed/playlist/abc123?utm_source=generator');
  });
});

describe('resolveNowPlaying', () => {
  it('prefers an explicit track override over any playlist', () => {
    const result = resolveNowPlaying({
      overrideTrackId: 'track-1',
      openArchivePlaylistUrl: 'https://open.spotify.com/playlist/openArchive1',
      fallbackPlaylistUrl: 'https://open.spotify.com/playlist/fallbackArchive1',
    });
    expect(result).toEqual({ type: 'track', id: 'track-1' });
  });

  it('falls back to the currently open archive playlist when there is no track override', () => {
    const result = resolveNowPlaying({
      overrideTrackId: null,
      openArchivePlaylistUrl: 'https://open.spotify.com/playlist/openArchive1',
      fallbackPlaylistUrl: 'https://open.spotify.com/playlist/fallbackArchive1',
    });
    expect(result).toEqual({ type: 'playlist', id: 'openArchive1' });
  });

  it('falls back to the fallback playlist when nothing is open and no track override', () => {
    const result = resolveNowPlaying({
      overrideTrackId: null,
      openArchivePlaylistUrl: null,
      fallbackPlaylistUrl: 'https://open.spotify.com/playlist/fallbackArchive1',
    });
    expect(result).toEqual({ type: 'playlist', id: 'fallbackArchive1' });
  });

  it('returns null when there is nothing to play at all', () => {
    const result = resolveNowPlaying({
      overrideTrackId: null,
      openArchivePlaylistUrl: null,
      fallbackPlaylistUrl: null,
    });
    expect(result).toBeNull();
  });
});
