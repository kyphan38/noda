// Background music player: one track at a time behind the lesson.
//
// Volume goes through a Web Audio GainNode: iOS Safari ignores audio.volume.
// Every change is a short ramp, never a hard cut. Browsers block sound until a
// user gesture, so nothing plays before unlock() is called from a click.
// The track URL must allow CORS, or MediaElementSource outputs silence.

import { rampMs, targetGain } from './gain';

export interface BgMusicEngine {
  /** Call from a click or key press: creates the AudioContext the browser allows. */
  unlock(): void;
  /** `trackGain` evens out loudness between tracks (1 for the defaults). */
  setSource(url: string | null, trackGain?: number): void;
  /** Percent, 0..MAX_VOLUME. */
  setVolume(volume: number): void;
  /** True while the lesson clip plays: music dips lightly. */
  setDucked(ducked: boolean): void;
  /** True when music should sound (see shouldPlay). */
  setActive(active: boolean): void;
  /** Loop the track (true) or call onEnded when it finishes (false). */
  setLoop(loop: boolean): void;
  onEnded(fn: (() => void) | null): void;
  dispose(): void;
}

export const noopBgMusicEngine: BgMusicEngine = {
  unlock: () => {},
  setSource: () => {},
  setVolume: () => {},
  setDucked: () => {},
  setActive: () => {},
  setLoop: () => {},
  onEnded: () => {},
  dispose: () => {},
};

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let shared: BgMusicEngine | null = null;

/**
 * One engine for the whole visit. Switching lesson tabs remounts the lesson view; a shared
 * engine keeps its unlocked AudioContext, so music goes on without another click.
 */
export function sharedBgMusicEngine(): BgMusicEngine {
  shared ??= createBgMusicEngine();
  return shared;
}

export function createBgMusicEngine(): BgMusicEngine {
  if (typeof window === 'undefined' || typeof Audio === 'undefined' || typeof AudioContext === 'undefined') {
    return noopBgMusicEngine;
  }

  const el = new Audio();
  el.loop = true;
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';

  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let url: string | null = null;
  let trackGain = 1;
  let volume = 0;
  let ducked = false;
  let active = false;
  /** The gain we last ramped to, so the next ramp picks the right speed. */
  let aimed = 0;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let swapTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let endedFn: (() => void) | null = null;

  el.addEventListener('ended', () => {
    // The next track starts from silence and fades in.
    if (ctx && gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
    }
    aimed = 0;
    endedFn?.();
  });

  const wanted = () => active && url !== null && ctx !== null;

  function rampTo(to: number) {
    if (!ctx || !gain) return;
    const ms = rampMs(aimed, to);
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + ms / 1000);
    aimed = to;
  }

  function clearPause() {
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
  }

  function apply() {
    if (disposed || swapTimer) return;
    const play = wanted();
    const to = targetGain(volume, ducked, play) * trackGain;
    if (play) {
      clearPause();
      if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
      if (el.paused) void el.play().catch(() => {});
      rampTo(to);
      return;
    }
    if (aimed !== 0) rampTo(0);
    // Pause after the fade so the element stops using CPU and network.
    if (!el.paused && !pauseTimer) {
      pauseTimer = setTimeout(() => {
        pauseTimer = null;
        if (!wanted()) el.pause();
      }, rampMs(1, 0));
    }
  }

  function loadSource(next: string | null, nextGain: number) {
    url = next;
    trackGain = nextGain;
    if (next) el.src = next;
    else {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    apply();
  }

  return {
    unlock() {
      if (disposed) return;
      if (!ctx) {
        // iOS: without this, the silent switch mutes Web Audio.
        const nav = navigator as AudioSessionNavigator;
        if (nav.audioSession) nav.audioSession.type = 'playback';
        ctx = new AudioContext();
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
      } else if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      apply();
    },
    setSource(next, nextGain = 1) {
      if (disposed) return;
      if (next === url) {
        if (nextGain !== trackGain) {
          trackGain = nextGain;
          apply();
        }
        return;
      }
      if (aimed === 0 || el.paused) {
        loadSource(next, nextGain);
        return;
      }
      // Fade the old track out before the new one fades in.
      rampTo(0);
      if (swapTimer) clearTimeout(swapTimer);
      swapTimer = setTimeout(() => {
        swapTimer = null;
        loadSource(next, nextGain);
      }, rampMs(1, 0));
    },
    setVolume(next) {
      volume = next;
      apply();
    },
    setDucked(next) {
      ducked = next;
      apply();
    },
    setActive(next) {
      active = next;
      apply();
    },
    setLoop(next) {
      el.loop = next;
    },
    onEnded(fn) {
      endedFn = fn;
    },
    dispose() {
      disposed = true;
      clearPause();
      if (swapTimer) clearTimeout(swapTimer);
      el.pause();
      el.removeAttribute('src');
      el.load();
      void ctx?.close().catch(() => {});
      ctx = null;
      gain = null;
    },
  };
}
