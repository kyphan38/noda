/**
 * Loads the YouTube IFrame Player API once and types the parts noda uses.
 * There is no official npm types package worth a dependency for this.
 */

export interface YTPlayerVars {
  autoplay?: 0 | 1;
  mute?: 0 | 1;
  controls?: 0 | 1;
  playsinline?: 0 | 1;
  rel?: 0 | 1;
  cc_load_policy?: 0 | 1;
  disablekb?: 0 | 1;
  iv_load_policy?: 1 | 3;
}

export interface YTVideoData {
  video_id?: string;
  title?: string;
  isLive?: boolean;
}

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  /** Not in the public docs, but stable for years. */
  getVideoData(): YTVideoData;
  /** Not in the public docs: used to read and turn off the captions module. */
  loadModule(name: string): void;
  unloadModule(name: string): void;
  getOption(module: string, option: string): unknown;
  destroy(): void;
}

export interface YTPlayerOptions {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  playerVars?: YTPlayerVars;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { target: YTPlayer; data: number }) => void;
    onError?: (e: { target: YTPlayer; data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Player states from the IFrame API docs. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

let loading: Promise<YTNamespace> | null = null;

export function loadYoutubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window.'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player API missing.'));
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      loading = null; // let a later call try again
      script.remove();
      reject(new Error('Could not load the YouTube player.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
