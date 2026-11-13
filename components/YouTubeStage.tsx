'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadYoutubeIframeApi, YT_STATE, type YTPlayer } from '@/lib/youtubeIframeApi';
import { YoutubeMediaAdapter } from '@/lib/youtubeMediaAdapter';

export interface YouTubeStageProps {
  videoId: string;
  /** Receives the adapter once the player is ready; the playback loop drives it like a media element. */
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  className?: string;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (seconds: number) => void;
  /** True once `mediaRef` holds this player. */
  onReadyChange?: (ready: boolean) => void;
}

/** IFrame API onError codes: 100 removed or private, 101/150 owner blocks embedding. */
function errorMessage(code: number): string {
  if (code === 100) return 'Video not found or private.';
  if (code === 101 || code === 150) return 'This video can only play on YouTube.';
  return 'Video can’t play right now.';
}

/**
 * The embedded YouTube player for a YouTube lesson. It stays visible (YouTube's
 * terms ask for at least 200×200) and keeps no controls of its own: the app's
 * player bar and shortcuts drive it through YoutubeMediaAdapter.
 */
export function YouTubeStage({ videoId, mediaRef, className, setIsPlaying, setDuration, onReadyChange }: YouTubeStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Callbacks change every render of the parent; the player must not restart for that.
  const callbacksRef = useRef({ setIsPlaying, setDuration, onReadyChange });
  useEffect(() => {
    callbacksRef.current = { setIsPlaying, setDuration, onReadyChange };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    const ref = mediaRef as React.MutableRefObject<HTMLMediaElement | null>;
    setError(null);

    const onPlay = () => callbacksRef.current.setIsPlaying(true);
    const onPause = () => callbacksRef.current.setIsPlaying(false);
    // In the ref at once, before the player loads: a seek or play sent in the
    // meantime (resume after a mode switch) waits in the adapter.
    const adapter = new YoutubeMediaAdapter();
    adapter.addEventListener('play', onPlay);
    adapter.addEventListener('pause', onPause);
    ref.current = adapter as unknown as HTMLMediaElement;

    // A click inside the frame gives it keyboard focus, and the app's shortcuts
    // (Space, Enter, arrows) stop reaching the page. Hand focus back.
    const onWindowBlur = () => {
      window.setTimeout(() => {
        const frame = host.querySelector('iframe');
        if (frame && document.activeElement === frame) frame.blur();
      }, 0);
    };
    window.addEventListener('blur', onWindowBlur);

    loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        const mount = document.createElement('div');
        host.appendChild(mount);
        player = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            rel: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              // Subtitles in the frame would give away dictation answers.
              e.target.unloadModule('captions');
              callbacksRef.current.setDuration(e.target.getDuration() || 0);
              adapter.attach(e.target);
              callbacksRef.current.onReadyChange?.(true);
            },
            onStateChange: (e) => {
              if (e.data === YT_STATE.PLAYING) {
                // YouTube can turn captions back on when playback starts.
                e.target.unloadModule('captions');
                const d = e.target.getDuration();
                if (d > 0) callbacksRef.current.setDuration(d);
              }
              adapter.handleStateChange(e.data);
            },
            onError: (e) => {
              setError(errorMessage(e.data));
              adapter.handleError();
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the YouTube player.');
      });

    return () => {
      cancelled = true;
      window.removeEventListener('blur', onWindowBlur);
      // Another lesson's <audio>/<video> may already hold the ref: only clear our own.
      if (ref.current === (adapter as unknown as HTMLMediaElement)) ref.current = null;
      adapter.removeEventListener('play', onPlay);
      adapter.removeEventListener('pause', onPause);
      callbacksRef.current.setIsPlaying(false);
      callbacksRef.current.onReadyChange?.(false);
      try {
        player?.destroy();
      } catch {
        // Already gone.
      }
      host.replaceChildren();
    };
  }, [videoId, mediaRef]);

  return (
    <div className={`relative bg-slate-900 overflow-hidden ${className ?? ''}`}>
      <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-3 text-center text-xs font-medium text-gray-100"
          role="status"
        >
          {error}
        </div>
      )}
    </div>
  );
}
