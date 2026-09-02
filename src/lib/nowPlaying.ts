import type { Track } from './types';

export interface QueueTrack {
  id: string;
  name: string;
  artists: string[];
  coverUrl: string;
  durationMs: number;
}

export function toQueueTrack(track: Track): QueueTrack {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists,
    coverUrl: track.coverUrl,
    durationMs: track.durationMs,
  };
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function randomIndex(length: number, rnd: () => number = Math.random): number {
  if (length <= 0) return 0;
  return Math.floor(rnd() * length);
}

// Spotify's embed plays a ~30s preview for listeners who aren't logged into a
// Premium account. There's no explicit flag for this in playback_update, but
// the embed's own reported duration is the giveaway: a real track's duration
// (from our own data) that's far longer than what the embed reports means
// we're hearing a preview, not the full song.
export function isPreviewPlayback(embedDurationMs: number, trackDurationMs: number, toleranceMs = 5000): boolean {
  if (embedDurationMs <= 0 || trackDurationMs <= 0) return false;
  return trackDurationMs - embedDurationMs > toleranceMs;
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
