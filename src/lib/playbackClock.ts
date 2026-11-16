import { useSyncExternalStore } from 'react';

/**
 * Frame-accurate playback time, kept outside React state.
 *
 * The playback loop reads the media element every animation frame. Putting each of
 * those readings into React state re-rendered the whole page (and walked the full
 * transcript) about 60 times a second. Instead, every reading goes into this clock,
 * and only the components that must move smoothly (the seek bar and the time
 * display) subscribe to it. Page state follows at a lower rate; see
 * `useMediaPlayer.reportPlaybackTime`.
 */
export interface PlaybackClock {
  get(): number;
  set(time: number): void;
  subscribe(listener: () => void): () => void;
}

export function createPlaybackClock(initial = 0): PlaybackClock {
  let time = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => time,
    set(next) {
      if (next === time) return;
      time = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Current playback time, re-rendering the caller on every clock change. */
export function usePlaybackTime(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}
