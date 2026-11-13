import { useEffect, useRef, useState } from 'react';
import { loadYoutubeIframeApi, type YTPlayer } from '@/lib/youtubeIframeApi';
import { pickUploadedEnglishTrack, type YoutubeCaptionTrack } from '@/lib/youtube';

export type YoutubeGateError =
  | 'no-uploaded-subs'
  | 'not-found'
  | 'not-embeddable'
  | 'live'
  | 'load-failed'
  | 'player-error';

export type YoutubeGateState =
  | { status: 'idle' }
  | { status: 'checking'; videoId: string }
  | { status: 'ok'; videoId: string; title: string; durationSec: number; trackLang: string }
  | { status: 'error'; videoId: string; reason: YoutubeGateError };

const POLL_MS = 300;
/** Tracks show up in ~300ms when there are any; no answer by then means none. */
const NO_TRACKS_AFTER_MS = 6000;

/** IFrame API onError codes: 2 bad id, 5 HTML5 error, 100 gone/private, 101/150 no embedding. */
function reasonForPlayerError(code: number): YoutubeGateError {
  if (code === 100 || code === 2) return 'not-found';
  if (code === 101 || code === 150) return 'not-embeddable';
  return 'player-error';
}

function readTracklist(player: YTPlayer): YoutubeCaptionTrack[] {
  try {
    // The captions module only fills the tracklist once loaded; loading twice is a no-op.
    player.loadModule('captions');
    const list = player.getOption('captions', 'tracklist');
    return Array.isArray(list) ? (list as YoutubeCaptionTrack[]) : [];
  } catch {
    return [];
  }
}

/**
 * Checks in the browser whether a video has English subtitles the channel
 * uploaded. YouTube blocks this lookup from Cloud Functions (PLAN-youtube.md, P0),
 * so a muted, off-screen player in the page asks instead. Attach `hostRef`
 * to an element that stays mounted while `videoId` is set.
 */
export function useYoutubeSubtitleGate(videoId: string | null) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<YoutubeGateState>({ status: 'idle' });

  useEffect(() => {
    if (!videoId) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'checking', videoId });
    const host = hostRef.current;

    let cancelled = false;
    let settled = false;
    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const settle = (next: YoutubeGateState) => {
      if (cancelled || settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      try {
        player?.pauseVideo();
      } catch {
        // The player may already be gone.
      }
      setState(next);
    };

    const startPolling = (p: YTPlayer) => {
      const startedAt = performance.now();
      poll = setInterval(() => {
        const data = p.getVideoData?.() ?? {};
        if (data.isLive) {
          settle({ status: 'error', videoId, reason: 'live' });
          return;
        }
        const track = pickUploadedEnglishTrack(readTracklist(p));
        if (track) {
          settle({
            status: 'ok',
            videoId,
            title: data.title ?? '',
            durationSec: p.getDuration() || 0,
            trackLang: track.languageCode,
          });
        } else if (performance.now() - startedAt > NO_TRACKS_AFTER_MS) {
          settle({ status: 'error', videoId, reason: 'no-uploaded-subs' });
        }
      }, POLL_MS);
    };

    loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled || !host) return;
        const mount = document.createElement('div');
        host.appendChild(mount);
        player = new YT.Player(mount, {
          videoId,
          width: 200,
          height: 200,
          playerVars: { autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              e.target.mute();
              e.target.playVideo();
              startPolling(e.target);
            },
            onError: (e) => settle({ status: 'error', videoId, reason: reasonForPlayerError(e.data) }),
          },
        });
      })
      .catch(() => settle({ status: 'error', videoId, reason: 'load-failed' }));

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        player?.destroy();
      } catch {
        // Already destroyed.
      }
      host?.replaceChildren();
    };
  }, [videoId]);

  return { hostRef, state };
}
