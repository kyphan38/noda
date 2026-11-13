import { YT_STATE, type YTPlayer } from '@/lib/youtubeIframeApi';

/**
 * Makes a YouTube IFrame player look like the small part of HTMLMediaElement
 * noda uses (see useLessonPlaybackLoop, useMediaPlayer, LessonView), so the
 * playback loop runs unchanged on YouTube lessons.
 *
 * The player answers through postMessage, so its state lags our commands by
 * ~200ms (PLAN-youtube.md, POC). `paused` and `currentTime` therefore follow
 * what we asked for until the player catches up, like a media element would.
 *
 * The adapter exists before the player is ready (switching modes remounts the
 * lesson view, and the new player takes ~1s to load). Commands sent before
 * `attach` are kept and applied then, so a resume seek is not lost.
 */

/** Player state reports this soon after our own play/pause are treated as stale. */
const STALE_STATE_MS = 1000;
/** Asked to play but the player stays stopped this long (e.g. blocked autoplay): give up. */
const PLAY_BLOCKED_MS = 2500;
/** A seek counts as done once the player reports a time this close to the target. */
const SEEK_SETTLED_S = 0.5;
/** ...or after this long, so a failed seek cannot hold the old target forever. */
const SEEK_GIVE_UP_MS = 2000;

type Listener = (event: Event) => void;

export class YoutubeMediaAdapter {
  /** Fixed: only used to tell a working video from a blank one, which YouTube never is. */
  readonly videoWidth = 640;
  private readonly listeners = new Map<string, Set<Listener>>();
  private wantsToPlay = false;
  private lastCommandAt = Number.NEGATIVE_INFINITY;
  private pendingSeek: { target: number; at: number } | null = null;
  private pendingRate: { rate: number; at: number } | null = null;
  private player: YTPlayer | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Call from the player's onReady. Applies what was asked for before then. */
  attach(player: YTPlayer): void {
    this.player = player;
    if (this.pendingRate) player.setPlaybackRate(this.pendingRate.rate);
    if (this.pendingSeek) {
      player.seekTo(this.pendingSeek.target, true);
      this.pendingSeek = { target: this.pendingSeek.target, at: this.now() };
    }
    if (this.wantsToPlay) {
      this.lastCommandAt = this.now();
      player.playVideo();
    } else if (this.pendingSeek) {
      // seekTo starts a video that never played; keep it still.
      player.pauseVideo();
    }
    this.emit('loadedmetadata');
    this.emit('canplay');
  }

  get paused(): boolean {
    return !this.wantsToPlay;
  }

  get currentTime(): number {
    if (!this.player) return this.pendingSeek?.target ?? 0;
    this.checkPlayBlocked();
    const raw = this.player.getCurrentTime() || 0;
    if (this.pendingSeek) {
      if (this.isSeekSettled(raw)) this.pendingSeek = null;
      else return this.pendingSeek.target;
    }
    return raw;
  }

  set currentTime(seconds: number) {
    const target = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    this.pendingSeek = { target, at: this.now() };
    // allowSeekAhead=true: false only seeks inside what is already buffered.
    this.player?.seekTo(target, true);
    this.emit('seeking');
  }

  get seeking(): boolean {
    if (!this.pendingSeek || !this.player) return false;
    if (this.isSeekSettled(this.player.getCurrentTime() || 0)) {
      this.pendingSeek = null;
      return false;
    }
    return true;
  }

  get duration(): number {
    const d = this.player?.getDuration() ?? 0;
    return d > 0 ? d : Number.NaN;
  }

  /** The player applies a new rate ~300ms later; until then report the one asked for. */
  get playbackRate(): number {
    const pending = this.pendingRate;
    if (!this.player) return pending?.rate ?? 1;
    const actual = this.player.getPlaybackRate();
    if (pending && Math.abs(actual - pending.rate) > 0.001 && this.now() - pending.at < STALE_STATE_MS) {
      return pending.rate;
    }
    this.pendingRate = null;
    return actual;
  }

  set playbackRate(rate: number) {
    this.pendingRate = { rate, at: this.now() };
    this.player?.setPlaybackRate(rate);
    this.emit('ratechange');
  }

  play(): Promise<void> {
    this.lastCommandAt = this.now();
    this.player?.playVideo();
    if (!this.wantsToPlay) {
      this.wantsToPlay = true;
      this.emit('play');
    }
    return Promise.resolve();
  }

  pause(): void {
    this.lastCommandAt = this.now();
    this.player?.pauseVideo();
    if (this.wantsToPlay) {
      this.wantsToPlay = false;
      this.emit('pause');
    }
  }

  /** Wire to the player's onStateChange. */
  handleStateChange(state: number): void {
    const stale = this.now() - this.lastCommandAt < STALE_STATE_MS;
    switch (state) {
      case YT_STATE.PLAYING:
        this.emit('playing');
        // Started from the YouTube frame itself (a click on the video).
        if (!this.wantsToPlay && !stale) {
          this.wantsToPlay = true;
          this.emit('play');
        }
        break;
      case YT_STATE.PAUSED:
        if (this.wantsToPlay && !stale) {
          this.wantsToPlay = false;
          this.emit('pause');
        }
        break;
      case YT_STATE.ENDED:
        if (this.wantsToPlay) {
          this.wantsToPlay = false;
          this.emit('pause');
        }
        this.emit('ended');
        break;
      case YT_STATE.BUFFERING:
        this.emit('waiting');
        break;
      case YT_STATE.CUED:
        this.emit('canplay');
        break;
    }
  }

  /** Wire to the player's onError. */
  handleError(): void {
    if (this.wantsToPlay) {
      this.wantsToPlay = false;
      this.emit('pause');
    }
    this.emit('error');
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string): void {
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return;
    const event = new Event(type);
    for (const listener of [...set]) listener(event);
  }

  private isSeekSettled(raw: number): boolean {
    const seek = this.pendingSeek;
    if (!seek) return true;
    return Math.abs(raw - seek.target) < SEEK_SETTLED_S || this.now() - seek.at > SEEK_GIVE_UP_MS;
  }

  /** The playback loop reads currentTime every frame while playing, so this runs often. */
  private checkPlayBlocked(): void {
    if (!this.player || !this.wantsToPlay || this.now() - this.lastCommandAt < PLAY_BLOCKED_MS) return;
    const state = this.player.getPlayerState();
    if (state === YT_STATE.PAUSED || state === YT_STATE.CUED || state === YT_STATE.UNSTARTED) {
      this.wantsToPlay = false;
      this.emit('pause');
    }
  }
}
