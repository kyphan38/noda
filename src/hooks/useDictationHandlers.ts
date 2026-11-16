'use client';

// Sentence click and the dictation input handlers of the lesson view.

import React, { useCallback, type RefObject } from 'react';
import { normalizeDictationTarget, alignDictationInput } from '@/lib/utils';
import { scrollTranscriptRowIntoView } from '@/lib/transcript-scroll';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { useLessonLogic } from '@/hooks/useLessonLogic';
import type { Sentence } from '@/types';
import { SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

type MediaPlayer = ReturnType<typeof useMediaPlayer>;
type LessonLogic = ReturnType<typeof useLessonLogic>;

export function useDictationHandlers({
  appModeRef,
  completedSentencesRef,
  dictationInputsRef,
  dictationReplayOnceRef,
  isLoopDelayingRef,
  lastScrolledIndexRef,
  loopTimeoutRef,
  mediaRef,
  scrollContainerRef,
  sentencePlayCountRef,
  setCompletedSentences,
  setCurrentTime,
  setDictationInputs,
  setIsPlaying,
  transcriptRef,
  userSeekTargetRef,
}: {
  appModeRef: LessonLogic['appModeRef'];
  completedSentencesRef: LessonLogic['completedSentencesRef'];
  dictationInputsRef: RefObject<LessonLogic['dictationInputs']>;
  dictationReplayOnceRef: RefObject<{ sentenceId: number; end: number } | null>;
  isLoopDelayingRef: MediaPlayer['isLoopDelayingRef'];
  lastScrolledIndexRef: RefObject<number>;
  loopTimeoutRef: MediaPlayer['loopTimeoutRef'];
  mediaRef: MediaPlayer['mediaRef'];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  sentencePlayCountRef: MediaPlayer['sentencePlayCountRef'];
  setCompletedSentences: LessonLogic['setCompletedSentences'];
  setCurrentTime: MediaPlayer['setCurrentTime'];
  setDictationInputs: LessonLogic['setDictationInputs'];
  setIsPlaying: MediaPlayer['setIsPlaying'];
  transcriptRef: RefObject<LessonLogic['transcript']>;
  userSeekTargetRef: MediaPlayer['userSeekTargetRef'];
}) {
  const handleSentenceClick = useCallback((sentence: Sentence) => {
    if (mediaRef.current) {
      const inDictation = appModeRef.current === 'dictation';
      // The "pre-roll" (a fraction of a second of lead-in before the clicked
      // sentence) must never land inside the PREVIOUS sentence's own [start, end)
      // cue window. When two cues sit back-to-back with a gap smaller than
      // SENTENCE_PRE_ROLL_SECONDS (including exactly 0, the normal case after the
      // overlap-clamp in parseTranscript), subtracting the pre-roll can seek to a
      // time that the playback loop resolves as "still the previous sentence" -
      // which then immediately re-triggers that previous sentence's own
      // pause-at-end / auto-rewind behavior and the UI snaps back to it instead
      // of landing on the sentence the user clicked. Clamp the lower bound to the
      // previous sentence's end so the pre-roll can never cross into it.
      const clickedIdx = transcriptRef.current.findIndex((s) => s.id === sentence.id);
      const prevSentence = clickedIdx > 0 ? transcriptRef.current[clickedIdx - 1] : null;
      const minSeekTarget = prevSentence ? prevSentence.end : 0;
      const seekTarget = inDictation
        ? sentence.start
        : Math.max(minSeekTarget, sentence.start - SENTENCE_PRE_ROLL_SECONDS);
      mediaRef.current.currentTime = seekTarget;
      setCurrentTime(sentence.start);
      lastScrolledIndexRef.current = -1;
      sentencePlayCountRef.current = 0;
      userSeekTargetRef.current = sentence.id;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
      if (inDictation) {
        dictationReplayOnceRef.current = { sentenceId: sentence.id, end: sentence.end };
        const container = scrollContainerRef.current;
        if (clickedIdx >= 0 && container && scrollTranscriptRowIntoView(container, clickedIdx, 'smooth')) {
          lastScrolledIndexRef.current = clickedIdx;
        }
      }
      if (mediaRef.current.paused) {
        mediaRef.current.play().catch(() => {});
      }
    }
  }, [mediaRef, appModeRef, setCurrentTime, lastScrolledIndexRef, loopTimeoutRef, isLoopDelayingRef, dictationReplayOnceRef, transcriptRef, scrollContainerRef, sentencePlayCountRef, userSeekTargetRef]);

  const handleDictationChange = useCallback((sentence: Sentence, val: string) => {
    const targetNorm = normalizeDictationTarget(sentence.text);
    const aligned = alignDictationInput(val, targetNorm);
    setDictationInputs((prev) => ({ ...prev, [sentence.id]: aligned }));

    const targetLetters = targetNorm.replace(/ /g, '');
    const inputLetters = aligned.replace(/ /g, '');

    if (
      targetLetters.length > 0 &&
      inputLetters.length === targetLetters.length &&
      inputLetters === targetLetters
    ) {
      setCompletedSentences((prev) => {
        const next = { ...prev, [sentence.id]: true };
        completedSentencesRef.current = next;
        return next;
      });

      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        isLoopDelayingRef.current = false;
      }

      const idx = transcriptRef.current.findIndex((s) => s.id === sentence.id);
      const container = scrollContainerRef.current;
      if (idx >= 0 && container && scrollTranscriptRowIntoView(container, idx, 'smooth')) {
        lastScrolledIndexRef.current = idx;
      }
    }
  }, [setDictationInputs, setCompletedSentences, completedSentencesRef, loopTimeoutRef, isLoopDelayingRef, transcriptRef, scrollContainerRef, lastScrolledIndexRef]);

  const handleDictationKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const isCompleted = !!completedSentencesRef.current[sentence.id];
      if (!isCompleted) return;

      const tr = transcriptRef.current;
      const idx = tr.findIndex((s) => s.id === sentence.id);
      const nextSentence = idx >= 0 && idx < tr.length - 1 ? tr[idx + 1] : null;

      if (mediaRef.current) {
        // Clean up any pending repeat timeout from the previous sentence
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          loopTimeoutRef.current = null;
        }
        isLoopDelayingRef.current = false;
        sentencePlayCountRef.current = 0;

        if (nextSentence) {
          dictationReplayOnceRef.current = { sentenceId: nextSentence.id, end: nextSentence.end };
          userSeekTargetRef.current = nextSentence.id;
          mediaRef.current.currentTime = nextSentence.start;
          setCurrentTime(nextSentence.start);
          lastScrolledIndexRef.current = -1;
          mediaRef.current.play().catch(() => {});
        } else {
          // last sentence: park at end
          mediaRef.current.currentTime = sentence.end + 0.03;
          setCurrentTime(sentence.end + 0.05);
          mediaRef.current.pause();
          setIsPlaying(false);
        }
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const t = normalizeDictationTarget(sentence.text);
      const tLetters = t.replace(/ /g, '');
      const cur = dictationInputsRef.current[sentence.id] || '';
      const curLetters = cur.replace(/ /g, '');
      let li = 0;
      while (li < curLetters.length && li < tLetters.length && curLetters[li] === tLetters[li]) li++;
      if (li >= tLetters.length) return;
      handleDictationChange(sentence, tLetters.slice(0, li + 1));
    } else if (e.key === 'Control') {
      e.preventDefault();
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        isLoopDelayingRef.current = false;
      }
      if (mediaRef.current) {
        dictationReplayOnceRef.current = { sentenceId: sentence.id, end: sentence.end };
        userSeekTargetRef.current = sentence.id;
        mediaRef.current.currentTime = sentence.start;
        setCurrentTime(sentence.start);
        mediaRef.current.play().catch(() => {});
      }
    }
  }, [completedSentencesRef, transcriptRef, dictationInputsRef, mediaRef, setCurrentTime, setIsPlaying, lastScrolledIndexRef, loopTimeoutRef, isLoopDelayingRef, dictationReplayOnceRef, handleDictationChange, sentencePlayCountRef, userSeekTargetRef]);

  const handleDictationRetry = useCallback((sentence: Sentence) => {
    setCompletedSentences((prev) => {
      const next = { ...prev };
      delete next[sentence.id];
      return next;
    });
    setDictationInputs((prev) => {
      const next = { ...prev };
      delete next[sentence.id];
      return next;
    });
  }, [setCompletedSentences, setDictationInputs]);

  /** Clears the current tab's progress, with a short Undo window instead of a confirm dialog. */

  return { handleSentenceClick, handleDictationChange, handleDictationKeyDown, handleDictationRetry };
}
