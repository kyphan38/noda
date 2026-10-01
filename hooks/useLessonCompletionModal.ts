import { useEffect, useRef, useState } from 'react';
import type { AppMode, Sentence } from '@/types';

type Selected = { id: string } | null;
type Done = Record<number, boolean>;

/** Sentences finished in both dictation and shadowing - a lesson is complete only when both are. */
function bothDoneCount(transcript: Sentence[], dictation: Done, shadowing: Done): number {
  return transcript.filter((s) => dictation[s.id] && shadowing[s.id]).length;
}

/**
 * Opens the "lesson complete" cleanup modal at the moment the last sentence is finished
 * in dictation or shadowing and both modes are then at 100%. Opening a lesson that is
 * already complete does not trigger it.
 */
export function useLessonCompletionModal(
  selectedItem: Selected,
  isStarted: boolean,
  transcript: Sentence[],
  appMode: AppMode,
  dictationCompleted: Done,
  shadowingCompleted: Done
) {
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const prevLessonIdRef = useRef<string | null>(null);
  const prevCountRef = useRef<number>(-1);

  useEffect(() => {
    const id = selectedItem?.id ?? null;
    const total = transcript.length;

    if (id !== prevLessonIdRef.current) {
      prevLessonIdRef.current = id;
      prevCountRef.current =
        id && isStarted && total > 0 ? bothDoneCount(transcript, dictationCompleted, shadowingCompleted) : -1;
      return;
    }

    if (!id || !isStarted || total === 0) return;

    const count = bothDoneCount(transcript, dictationCompleted, shadowingCompleted);
    if (
      appMode !== 'listen' &&
      prevCountRef.current !== -1 &&
      prevCountRef.current < total &&
      count === total
    ) {
      setShowCleanupModal(true);
    }
    prevCountRef.current = count;
  }, [selectedItem?.id, appMode, dictationCompleted, shadowingCompleted, transcript, isStarted]);

  return { showCleanupModal, setShowCleanupModal };
}
