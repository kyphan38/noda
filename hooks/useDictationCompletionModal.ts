import { useEffect, useRef, useState } from 'react';
import type { AppMode, Sentence } from '@/types';

type Selected = { id: string } | null;

function completedCount(transcript: Sentence[], completedSentences: Record<number, boolean>): number {
  return transcript.filter((s) => completedSentences[s.id]).length;
}

/**
 * Opens the post-dictation cleanup modal when all sentences are completed in dictation mode.
 */
export function useDictationCompletionModal(
  selectedItem: Selected,
  isStarted: boolean,
  transcript: Sentence[],
  appMode: AppMode,
  completedSentences: Record<number, boolean>
) {
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const prevLessonIdForCompletionRef = useRef<string | null>(null);
  const prevCompletedCountRef = useRef<number>(-1);

  useEffect(() => {
    const id = selectedItem?.id ?? null;
    const total = transcript.length;

    if (id !== prevLessonIdForCompletionRef.current) {
      prevLessonIdForCompletionRef.current = id;
      if (id && isStarted && total > 0) {
        prevCompletedCountRef.current = completedCount(transcript, completedSentences);
      } else {
        prevCompletedCountRef.current = -1;
      }
      return;
    }

    if (!id || !isStarted || total === 0) {
      return;
    }

    const currentCount = completedCount(transcript, completedSentences);

    if (
      appMode === 'dictation' &&
      prevCompletedCountRef.current !== -1 &&
      prevCompletedCountRef.current < total &&
      currentCount === total
    ) {
      setShowCleanupModal(true);
    }

    prevCompletedCountRef.current = currentCount;
  }, [selectedItem?.id, appMode, completedSentences, transcript, isStarted]);

  return {
    showCleanupModal,
    setShowCleanupModal,
  };
}
