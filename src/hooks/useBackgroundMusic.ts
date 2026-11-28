'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { sharedBgMusicEngine, type BgMusicEngine } from '@/lib/bgMusic/engine';
import { shouldPlay } from '@/lib/bgMusic/gain';
import { bgMusicPrefsStore } from '@/lib/bgMusic/prefs';
import { DEFAULT_TRACKS, pickTrackUrl } from '@/lib/bgMusic/tracks';
import type { AppMode } from '@/types';

type Options = {
  mode: AppMode;
  /** Speaking check is open: the mic must not hear the music. */
  micOpen: boolean;
  /** The lesson clip is playing: music dips lightly. */
  clipPlaying: boolean;
};

/**
 * Background music behind a lesson (PLAN-bg-music.md). Mounted only by LessonView, so it
 * stops when the learner leaves the lesson; Talk and Speaking never mount it.
 */
export function useBackgroundMusic({ mode, micOpen, clipPlaying }: Options): void {
  const prefs = useSyncExternalStore(bgMusicPrefsStore.subscribe, bgMusicPrefsStore.get, bgMusicPrefsStore.getServer);
  const engineRef = useRef<BgMusicEngine | null>(null);

  const url = pickTrackUrl(prefs.trackId, DEFAULT_TRACKS);
  const active = url !== null && shouldPlay({ enabled: prefs.enabled, mode, micOpen });

  useEffect(() => {
    // The engine is made only once music is wanted, so the app is unchanged while it is off.
    if (active && !engineRef.current) engineRef.current = sharedBgMusicEngine();
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSource(url);
    engine.setVolume(prefs.volume);
    engine.setDucked(clipPlaying);
    engine.setActive(active);
  }, [active, url, prefs.volume, clipPlaying]);

  // Browsers allow sound only after a gesture: the next click or key press unlocks it.
  useEffect(() => {
    if (!active) return;
    const unlock = () => engineRef.current?.unlock();
    window.addEventListener('pointerup', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerup', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [active]);

  // Leaving the lesson fades the music out. The engine stays for the next lesson view.
  useEffect(() => () => engineRef.current?.setActive(false), []);
}
