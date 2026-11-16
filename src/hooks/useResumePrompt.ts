'use client';

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';

import { useLessonLogic } from '@/hooks/useLessonLogic';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { findResumeTarget } from '@/lib/progress';
import { scrollTranscriptRowIntoView } from '@/lib/transcript-scroll';
import type { AppMode } from '@/types';

type MediaPlayer = ReturnType<typeof useMediaPlayer>;
type LessonLogic = ReturnType<typeof useLessonLogic>;

export function useResumePrompt({
  loadedProgress,
  selectedId,
  completedSentences,
  transcript,
  isPlaying,
  appModeRef,
  handleModeChange,
  mediaRef,
  setCurrentTime,
  lastScrolledIndexRef,
  scrollContainerRef,
}: {
  loadedProgress: LessonLogic['loadedProgress'];
  selectedId: string | undefined;
  completedSentences: LessonLogic['completedSentences'];
  transcript: LessonLogic['transcript'];
  isPlaying: MediaPlayer['isPlaying'];
  appModeRef: LessonLogic['appModeRef'];
  handleModeChange: (mode: AppMode) => unknown;
  mediaRef: MediaPlayer['mediaRef'];
  setCurrentTime: MediaPlayer['setCurrentTime'];
  lastScrolledIndexRef: RefObject<number>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  // "Continue" prompt: built from the progress saved when the lesson was opened. It goes
  // away once used, dismissed, or as soon as playback starts some other way.
  const [resumeDismissedFor, setResumeDismissedFor] = useState<string | null>(null);
  const resumeTarget = useMemo(() => {
    if (!loadedProgress || loadedProgress.lessonId !== selectedId) return null;
    if (resumeDismissedFor === loadedProgress.lessonId) return null;
    return findResumeTarget(loadedProgress.lastMode, loadedProgress.progress, completedSentences, transcript);
  }, [loadedProgress, selectedId, resumeDismissedFor, completedSentences, transcript]);

  const dismissResume = useCallback(() => {
    if (loadedProgress) setResumeDismissedFor(loadedProgress.lessonId);
  }, [loadedProgress]);

  useEffect(() => {
    if (isPlaying) dismissResume();
  }, [isPlaying, dismissResume]);

  const handleResume = useCallback(async () => {
    const target = resumeTarget;
    if (!target) return;
    dismissResume();
    if (appModeRef.current !== target.mode) await handleModeChange(target.mode);
    // Switching tabs remounts the lesson view (and its media element), so seek and scroll
    // once the new view is on screen.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const media = mediaRef.current;
        if (media) media.currentTime = target.time;
        setCurrentTime(target.time);
        lastScrolledIndexRef.current = -1;
        const container = scrollContainerRef.current;
        if (container && scrollTranscriptRowIntoView(container, target.index, 'smooth')) {
          lastScrolledIndexRef.current = target.index;
        }
      });
    });
  }, [resumeTarget, dismissResume, appModeRef, handleModeChange, mediaRef, setCurrentTime, lastScrolledIndexRef, scrollContainerRef]);

  return { resumeTarget, dismissResume, handleResume };
}
