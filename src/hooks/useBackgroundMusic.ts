'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getBgTrackUrl } from '@/lib/db';
import { sharedBgMusicEngine, type BgMusicEngine } from '@/lib/bgMusic/engine';
import { shouldPlay } from '@/lib/bgMusic/gain';
import { bgMusicPrefsStore } from '@/lib/bgMusic/prefs';
import { nextTrack, pickTrack } from '@/lib/bgMusic/tracks';
import { useBgTracks } from '@/hooks/useBgTracks';
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
 * Starts at the chosen track, then plays on through its category.
 */
export function useBackgroundMusic({ mode, micOpen, clipPlaying }: Options): void {
  const prefs = useSyncExternalStore(bgMusicPrefsStore.subscribe, bgMusicPrefsStore.get, bgMusicPrefsStore.getServer);
  const engineRef = useRef<BgMusicEngine | null>(null);

  const tracks = useBgTracks();
  const chosen = pickTrack(prefs.trackId, tracks);
  // After a track ends the next one plays; a new choice in Settings starts over from it.
  const [auto, setAuto] = useState<{ from: string; id: string } | null>(null);
  const currentId = auto && auto.from === chosen?.id ? auto.id : (chosen?.id ?? null);
  const current = currentId ? (tracks.find((t) => t.id === currentId) ?? null) : null;
  const nextId = currentId ? (nextTrack(currentId, tracks)?.id ?? null) : null;

  const [urls, setUrls] = useState<Record<string, string>>({});
  const url = currentId ? (urls[currentId] ?? null) : null;
  const active = currentId !== null && shouldPlay({ enabled: prefs.enabled, mode, micOpen });

  // Look up the current track and the next one, so the change at the end has no wait.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    for (const id of [currentId, nextId]) {
      const track = id ? tracks.find((t) => t.id === id) : undefined;
      if (!id || !track || urls[id]) continue;
      getBgTrackUrl(track.path)
        .then((u) => !cancelled && setUrls((m) => ({ ...m, [id]: u })))
        .catch(() => {
          // Offline or signed out: the lesson goes on without music.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [active, currentId, nextId, urls, tracks]);

  useEffect(() => {
    // The engine is made only once music is wanted, so the app is unchanged while it is off.
    if (active && !engineRef.current) engineRef.current = sharedBgMusicEngine();
    const engine = engineRef.current;
    if (!engine) return;
    engine.setLoop(nextId === currentId);
    engine.onEnded(() => {
      if (chosen && nextId) setAuto({ from: chosen.id, id: nextId });
    });
    // While the next URL loads, keep what is playing rather than cutting to silence.
    if (url) engine.setSource(url, current?.gain ?? 1);
    engine.setVolume(prefs.volume);
    engine.setDucked(clipPlaying);
    engine.setActive(active);
  }, [active, url, prefs.volume, clipPlaying, chosen, current, currentId, nextId]);

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
  useEffect(
    () => () => {
      engineRef.current?.setActive(false);
      engineRef.current?.onEnded(null);
    },
    []
  );
}
