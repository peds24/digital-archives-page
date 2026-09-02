const API_SCRIPT_SRC = 'https://open.spotify.com/embed/iframe-api/v1';

export interface PlaybackUpdatePayload {
  playingURI: string;
  isPaused: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
}

export interface EmbedController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: 'ready', callback: () => void): void;
  addListener(event: 'playback_update', callback: (event: { data: PlaybackUpdatePayload }) => void): void;
}

export interface CreateControllerOptions {
  uri: string;
  width?: number | string;
  height?: number | string;
}

interface IFrameAPI {
  createController(
    element: HTMLElement,
    options: CreateControllerOptions,
    callback: (controller: EmbedController) => void
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

let apiPromise: Promise<IFrameAPI> | null = null;

// Spotify's iframe API is a singleton: it calls window.onSpotifyIframeApiReady
// once, globally, however many controllers get created afterward. The script
// tag is likewise loaded at most once per page, cached across callers.
export function loadSpotifyIframeApi(): Promise<IFrameAPI> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement('script');
    script.src = API_SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}
