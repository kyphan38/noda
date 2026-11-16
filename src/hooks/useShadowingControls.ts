'use client';

import { useCallback, type RefObject } from 'react';

import { useLessonLogic } from '@/hooks/useLessonLogic';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { cycleRepeatCount as getNextRepeatCount } from '@/lib/repeat-count';
import type { Sentence } from '@/types';

type MediaPlayer = ReturnType<typeof useMediaPlayer>;
type LessonLogic = ReturnType<typeof useLessonLogic>;

/** Repeat count and "next line" for Shadowing (Enter key and the tap button). */
export function useShadowingControls({
  repeatCount,
  changeRepeatCount,
  mediaRef,
  transcriptRef,
  activeSentenceRef,
  shadowingCompletedRef,
  setShadowingCompleted,
  userSeekTargetRef,
  setCurrentTime,
  loopTimeoutRef,
  isLoopDelayingRef,
}: {
  repeatCount: MediaPlayer['repeatCount'];
  changeRepeatCount: MediaPlayer['changeRepeatCount'];
  mediaRef: MediaPlayer['mediaRef'];
  transcriptRef: RefObject<LessonLogic['transcript']>;
  activeSentenceRef: RefObject<Sentence | null>;
  shadowingCompletedRef: LessonLogic['shadowingCompletedRef'];
  setShadowingCompleted: LessonLogic['setShadowingCompleted'];
  userSeekTargetRef: MediaPlayer['userSeekTargetRef'];
  setCurrentTime: MediaPlayer['setCurrentTime'];
  loopTimeoutRef: MediaPlayer['loopTimeoutRef'];
  isLoopDelayingRef: MediaPlayer['isLoopDelayingRef'];
}) {
  const cycleRepeatCount = useCallback(() => {
    changeRepeatCount(getNextRepeatCount(repeatCount));
  }, [repeatCount, changeRepeatCount]);

  // Shadowing: mark the current line as shadowed, then jump to the next line and play it (Enter key).
  const handleShadowingNext = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    const tr = transcriptRef.current;
    const current = activeSentenceRef.current;
    if (current && !shadowingCompletedRef.current[current.id]) {
      setShadowingCompleted((prev) => {
        const next = { ...prev, [current.id]: true };
        shadowingCompletedRef.current = next;
        return next;
      });
    }
    const next = current
      ? tr.find((s) => s.start > current.start)
      : tr.find((s) => s.start > media.currentTime);
    if (!next) return;
    userSeekTargetRef.current = next.id;
    media.currentTime = next.start;
    setCurrentTime(next.start);
    media.play().catch(() => {});
  }, [mediaRef, activeSentenceRef, transcriptRef, setCurrentTime, userSeekTargetRef, shadowingCompletedRef, setShadowingCompleted]);

  // Tap version of the Shadowing Enter key: phones and iPads have no Enter key outside a text
  // field. Same steps as the keyboard path in useGlobalPlaybackShortcuts.
  const handleShadowingNextTap = useCallback(() => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
    }
    handleShadowingNext();
  }, [handleShadowingNext, loopTimeoutRef, isLoopDelayingRef]);

  return { cycleRepeatCount, handleShadowingNext, handleShadowingNextTap };
}
