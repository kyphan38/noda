import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, LoopMode, Sentence } from '@/types';
import { SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

type RefBool = MutableRefObject<boolean>;
type RefMode = MutableRefObject<AppMode>;
type RefCompleted = MutableRefObject<Record<number, boolean>>;
type RefReplayOnce = MutableRefObject<{ sentenceId: number; end: number } | null>;

/**
 * While audio is playing, updates current time, active sentence ref, dictation pause-at-end, and loop-one behavior.
 */
export function useLessonPlaybackLoop(
  isPlaying: boolean,
  transcript: Sentence[],
  setCurrentTime: (t: number) => void,
  audioRef: RefObject<HTMLMediaElement | null>,
  loopTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  isLoopDelayingRef: RefBool,
  loopModeRef: MutableRefObject<LoopMode>,
  appModeRef: RefMode,
  completedSentencesRef: RefCompleted,
  activeSentenceRef: MutableRefObject<Sentence | null>,
  replayOnceRef: RefReplayOnce
) {
  useEffect(() => {
    let animationFrameId: number;
    // Tracks the sentence id from the previous frame to detect adjacent-sentence
    // boundary crossings that a single slow frame could skip over.
    let lastActiveSentenceId: number | null = null;

    const updateProgress = () => {
      if (audioRef.current) {
        // Mobile browsers can take multiple RAF frames to resolve a seek.
        // Running gap/boundary checks on stale currentTime would trigger
        // conflicting seeks, causing timeline ↔ active-sentence mismatch.
        if (audioRef.current.seeking) {
          animationFrameId = requestAnimationFrame(updateProgress);
          return;
        }

        let time = audioRef.current.currentTime;

        const prevActiveSentenceId = lastActiveSentenceId;
        const currentSentence = transcript.find((s) => time >= s.start && time < s.end);
        activeSentenceRef.current = currentSentence ?? null;
        lastActiveSentenceId = currentSentence?.id ?? null;

        // All correction branches update `time` so setCurrentTime (called last)
        // never exposes an overshoot to React state — prevents isActive flicker.
        //
        // Adjacent-sentence boundary guard: in dictation mode without replayOnce,
        // a slow RAF frame can jump directly from sentence X into sentence Y (when
        // X.end === Y.start with no gap), skipping the end-of-sentence pause entirely.
        // Detect that transition and park at the previous sentence's end.
        if (
          appModeRef.current === 'dictation' &&
          !replayOnceRef.current &&
          prevActiveSentenceId !== null &&
          currentSentence !== undefined &&
          currentSentence.id !== prevActiveSentenceId
        ) {
          const prevSent = transcript.find((s) => s.id === prevActiveSentenceId);
          if (prevSent) {
            audioRef.current.pause();
            time = prevSent.end - 0.05;
            audioRef.current.currentTime = time;
            activeSentenceRef.current = prevSent;
            lastActiveSentenceId = prevSent.id;
          }
        } else if (
          appModeRef.current === 'dictation' &&
          replayOnceRef.current &&
          time >= replayOnceRef.current.end - 0.03
        ) {
          audioRef.current.pause();
          time = replayOnceRef.current.end - 0.05;
          audioRef.current.currentTime = time;
          replayOnceRef.current = null;
        } else if (activeSentenceRef.current) {
          if (time >= activeSentenceRef.current.end - 0.03) {
            if (loopModeRef.current === 'one') {
              if (!isLoopDelayingRef.current) {
                isLoopDelayingRef.current = true;
                audioRef.current.pause();
                loopTimeoutRef.current = setTimeout(() => {
                  if (audioRef.current && loopModeRef.current === 'one' && activeSentenceRef.current) {
                    const preRoll = appModeRef.current === 'dictation' ? 0 : SENTENCE_PRE_ROLL_SECONDS;
                    audioRef.current.currentTime = Math.max(0, activeSentenceRef.current.start - preRoll);
                    audioRef.current.play().catch(() => {});
                  }
                  isLoopDelayingRef.current = false;
                }, 500);
              }
            } else if (appModeRef.current === 'dictation') {
              // Don't stop if replayOnceRef targets a different sentence — we're in
              // transit (e.g. float imprecision placed us at the previous sentence's end).
              if (replayOnceRef.current && replayOnceRef.current.sentenceId !== activeSentenceRef.current.id) {
                // skip — let the replayOnce check handle it on a future frame
              } else {
                audioRef.current.pause();
                time = activeSentenceRef.current.end - 0.03;
                audioRef.current.currentTime = time;
              }
            }
          }
        } else if (appModeRef.current === 'dictation' && !audioRef.current.paused) {
          // Audio overshot into a gap. Park at the next sentence's speech start and set
          // replayOnce so resuming plays exactly that sentence and stops at its end.
          const next = transcript.find((s) => s.start > time);
          audioRef.current.pause();
          if (next) {
            time = next.start;
            replayOnceRef.current = { sentenceId: next.id, end: next.end };
          } else {
            time = (transcript.findLast((s) => time >= s.end)?.end ?? time) - 0.05;
          }
          audioRef.current.currentTime = time;
        }

        setCurrentTime(time);
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [
    isPlaying,
    transcript,
    setCurrentTime,
    loopTimeoutRef,
    isLoopDelayingRef,
    loopModeRef,
    appModeRef,
    completedSentencesRef,
    audioRef,
    activeSentenceRef,
    replayOnceRef,
  ]);
}
