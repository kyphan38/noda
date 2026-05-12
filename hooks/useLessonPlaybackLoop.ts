import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, LoopMode, Sentence } from '@/types';
import { SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

type RefBool = MutableRefObject<boolean>;
type RefMode = MutableRefObject<AppMode>;
type RefCompleted = MutableRefObject<Record<number, boolean>>;
type RefReplayOnce = MutableRefObject<{ sentenceId: number; end: number } | null>;

/**
 * While audio is playing, updates current time, active sentence ref, dictation/shadowing pause-at-end, and loop-one behavior.
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

    const updateProgress = () => {
      if (audioRef.current) {
        let time = audioRef.current.currentTime;

        const currentSentence = transcript.find((s) => time >= s.start && time < s.end);
        activeSentenceRef.current = currentSentence ?? null;

        // All correction branches update `time` so setCurrentTime (called last)
        // never exposes an overshoot to React state — prevents isActive flicker.
        if (
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
                    audioRef.current.currentTime = Math.max(
                      0,
                      activeSentenceRef.current.start - SENTENCE_PRE_ROLL_SECONDS
                    );
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
            } else if (appModeRef.current === 'shadowing') {
              audioRef.current.pause();
              time = activeSentenceRef.current.end - 0.03;
              audioRef.current.currentTime = time;
            }
          }
        } else if (appModeRef.current === 'dictation' && !audioRef.current.paused) {
          // Fallback: audio overshot into a gap between sentences and replayOnceRef
          // was already consumed. Find the sentence we just passed and park there.
          const passed = transcript.findLast((s) => time >= s.end);
          if (passed) {
            audioRef.current.pause();
            time = passed.end - 0.05;
            audioRef.current.currentTime = time;
          }
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
