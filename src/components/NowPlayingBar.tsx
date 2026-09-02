import type { CSSProperties } from 'react';
import type { NowPlayingController } from '../hooks/useNowPlaying';
import { formatTime, isPreviewPlayback } from '../lib/nowPlaying';

interface NowPlayingBarProps {
  player: NowPlayingController;
  maxWidth: number | null;
}

export function NowPlayingBar({ player, maxWidth }: NowPlayingBarProps) {
  const { hostRef, current, hasNext, hasPrev, isPaused, isBuffering, position, duration, togglePlay, next, prev } = player;

  const style = maxWidth ? ({ '--nav-width': `${maxWidth}px` } as CSSProperties) : undefined;

  return (
    <div className="now-playing-bar" style={style}>
      {/* Kept in the DOM (not display:none) so the embed reliably keeps playing/reporting state. */}
      <div ref={hostRef} className="now-playing-host" aria-hidden="true" />
      {current && (
        <>
          <button type="button" onClick={prev} disabled={!hasPrev} aria-label="Previous track">‹‹</button>
          <img className="now-playing-art" src={current.coverUrl} alt="" width={32} height={32} />
          <div className="now-playing-meta">
            <span className="now-playing-title">{current.name}</span>
            <span className="now-playing-artist">{current.artists.join(', ')}</span>
          </div>
          {isPreviewPlayback(duration, current.durationMs) && <span className="now-playing-preview-badge">preview</span>}
          <span className="now-playing-time">{formatTime(position)} / {formatTime(duration || current.durationMs)}</span>
          <button type="button" onClick={togglePlay} aria-label={isPaused ? 'Play' : 'Pause'}>
            {isBuffering ? '…' : isPaused ? '▶' : '❚❚'}
          </button>
          <button type="button" onClick={next} disabled={!hasNext} aria-label="Next track">››</button>
          <div className="now-playing-progress" style={{ width: duration ? `${Math.min(100, (position / duration) * 100)}%` : '0%' }} />
        </>
      )}
    </div>
  );
}
