import { useEffect, useRef } from 'react';
import { saveResumePositionFirestore } from '@/lib/db';
import { RESUME_SAVE_INTERVAL_MS } from '@/constants';
import type { AppMode } from '@/types';

type Position = { lastIndex: number } | { lastTime: number };

/**
 * Saves where the learner is in the current tab: the playback time in listen, the
 * active sentence index in dictation and shadowing. It also records the tab as the
 * lesson's `lastMode`.
 *
 * Nothing is written until the position actually moves after the lesson or tab
 * was opened. Just opening a lesson (which lands in listen at 0:00) must not
 * overwrite the last real spot, or "Continue" would always point at listen.
 *
 * Throttled rather than debounced: `currentTime` changes every frame while
 * playing, so a debounce would never fire. Writes at most once per
 * RESUME_SAVE_INTERVAL_MS, and flushes the pending position when the tab or
 * lesson changes.
 */
export function useResumePositionSaver(
  lessonId: string | null,
  appMode: AppMode,
  activeIndex: number,
  currentTime: number,
  enabled: boolean
) {
  const position: Position | null =
    activeIndex < 0
      ? null
      : appMode === 'listen'
        ? { lastTime: Math.floor(currentTime) }
        : { lastIndex: activeIndex };
  const key = position ? ('lastTime' in position ? position.lastTime : position.lastIndex) : null;

  const baselineRef = useRef<number | null>(null);
  const pendingRef = useRef<Position | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeRef = useRef<{ lessonId: string | null; appMode: AppMode }>({ lessonId, appMode });

  // New lesson or tab: flush what the previous one had pending, then take a new baseline.
  useEffect(() => {
    const scope = { lessonId, appMode };
    scopeRef.current = scope;
    baselineRef.current = null;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && scope.lessonId) {
        saveResumePositionFirestore(scope.lessonId, scope.appMode, pending).catch((error) => {
          console.error('Failed to save resume position', error);
        });
      }
    };
  }, [lessonId, appMode]);

  useEffect(() => {
    if (!enabled || !lessonId || key === null || !position) return;
    if (baselineRef.current === null) {
      baselineRef.current = key;
      return;
    }
    if (key === baselineRef.current && !pendingRef.current) return;

    pendingRef.current = position;
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      const scope = scopeRef.current;
      if (!pending || !scope.lessonId) return;
      saveResumePositionFirestore(scope.lessonId, scope.appMode, pending).catch((error) => {
        console.error('Failed to save resume position', error);
      });
    }, RESUME_SAVE_INTERVAL_MS);
    // `position` is rebuilt every render; `key` is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lessonId, appMode, key]);
}
