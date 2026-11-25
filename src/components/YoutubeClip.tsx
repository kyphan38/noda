'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { loadYoutubeIframeApi, YT_STATE, type YTPlayer } from '@/lib/youtubeIframeApi';

export type ClipHandle = { play: () => void };

/** How often the end of the line is checked: the player only reports its time when asked. */
const END_CHECK_MS = 100;

/**
 * A small YouTube player for one line: plays from `start` once ready, stops at `end`,
 * and `play()` (through `ref`) plays the line again. Captions stay off: they would give
 * the answer away.
 */
export function YoutubeClip({ videoId, start, end, ref }: { videoId: string; start: number; end: number; ref?: Ref<ClipHandle> }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playLine = () => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(start, true);
    p.playVideo();
  };
  useImperativeHandle(ref, () => ({ play: playLine }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        const mount = document.createElement('div');
        host.appendChild(mount);
        player = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, cc_load_policy: 0, iv_load_policy: 3 },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              e.target.unloadModule('captions');
              playerRef.current = e.target;
              e.target.seekTo(start, true);
              e.target.playVideo();
              timer = setInterval(() => {
                const p = playerRef.current;
                if (p && p.getPlayerState() === YT_STATE.PLAYING && p.getCurrentTime() >= end) p.pauseVideo();
              }, END_CHECK_MS);
            },
            onStateChange: (e) => {
              // YouTube can turn captions back on when playback starts.
              if (e.data === YT_STATE.PLAYING) e.target.unloadModule('captions');
            },
            onError: () => setError('This video cannot play here.'),
          },
        });
      })
      .catch(() => !cancelled && setError('Could not load the YouTube player.'));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // Already gone.
      }
      host.replaceChildren();
    };
  }, [videoId, start, end]);

  return (
    <div className="space-y-1">
      <div ref={hostRef} className="aspect-video w-full max-w-xs overflow-hidden rounded-lg bg-black" />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
