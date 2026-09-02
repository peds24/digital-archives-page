import { useEffect, useRef, useState } from 'react';
import { clampIndex, type QueueTrack } from '../lib/nowPlaying';
import { loadSpotifyIframeApi, type EmbedController } from '../lib/spotifyIframeApi';

interface PlaybackState {
  isPaused: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
}

const IDLE_PLAYBACK: PlaybackState = { isPaused: true, isBuffering: false, position: 0, duration: 0 };

/**
 * Drives a hidden Spotify embed one track at a time via the official iframe
 * API, so the visible player is entirely our own UI. `initialTracks` seeds
 * the embed as soon as it's non-empty (the archive library loads
 * asynchronously, so that isn't necessarily mount); after that, callers
 * advance playback with playQueue/next/prev.
 */
export function useNowPlaying(initialTracks: QueueTrack[]) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playback, setPlayback] = useState<PlaybackState>(IDLE_PLAYBACK);

  // A primitive, not the array itself: initialTracks is rebuilt fresh every
  // App render, but the underlying data (the newest archive) only actually
  // becomes available once, so this only actually changes once too.
  const readyTrackId = initialTracks[0]?.id ?? null;

  useEffect(() => {
    if (!readyTrackId || !hostRef.current) return;
    let cancelled = false;

    loadSpotifyIframeApi().then((IFrameAPI) => {
      if (cancelled || !hostRef.current) return;
      IFrameAPI.createController(
        hostRef.current,
        { uri: `spotify:track:${readyTrackId}`, width: 1, height: 1 },
        (controller) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          controllerRef.current = controller;
          controller.addListener('playback_update', (event) => {
            setPlayback({
              isPaused: event.data.isPaused,
              isBuffering: event.data.isBuffering,
              position: event.data.position,
              duration: event.data.duration,
            });
          });
          setQueue(initialTracks);
          setIndex(0);
        }
      );
    });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
    // initialTracks itself isn't a dep: readyTrackId already captures the one
    // moment its content changes from empty to real (see comment above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyTrackId]);

  function playQueue(tracks: QueueTrack[], startIndex: number, { autoplay }: { autoplay: boolean }) {
    if (tracks.length === 0) return;
    const clamped = clampIndex(startIndex, tracks.length);
    setQueue(tracks);
    setIndex(clamped);
    // Reset immediately rather than waiting on the embed's next playback_update —
    // otherwise a newly loaded track briefly shows the previous track's stale
    // position and pause state.
    setPlayback({ isPaused: !autoplay, isBuffering: autoplay, position: 0, duration: 0 });
    const controller = controllerRef.current;
    if (!controller) return;
    controller.loadUri(`spotify:track:${tracks[clamped].id}`);
    if (autoplay) controller.play();
  }

  function togglePlay() {
    controllerRef.current?.togglePlay();
  }

  function next() {
    if (index < queue.length - 1) playQueue(queue, index + 1, { autoplay: true });
  }

  function prev() {
    if (index > 0) playQueue(queue, index - 1, { autoplay: true });
  }

  return {
    hostRef,
    current: queue[index] ?? null,
    hasNext: index < queue.length - 1,
    hasPrev: index > 0,
    ...playback,
    playQueue,
    togglePlay,
    next,
    prev,
  };
}

export type NowPlayingController = ReturnType<typeof useNowPlaying>;
