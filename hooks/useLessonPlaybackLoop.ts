import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, LoopMode, Sentence } from '@/types';

type RefBool = MutableRefObject<boolean>;
type RefMode = MutableRefObject<AppMode>;
type RefCompleted = MutableRefObject<Record<number, boolean>>;

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
  activeSentenceRef: MutableRefObject<Sentence | null>
) {
  useEffect(() => {
    let animationFrameId: number;

    const updateProgress = () => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);

        const currentSentence = transcript.find((s) => time >= s.start && time < s.end);
        if (currentSentence) {
          activeSentenceRef.current = currentSentence;
        } else {
          activeSentenceRef.current = null;
        }

        if (activeSentenceRef.current) {
          const isCompleted = completedSentencesRef.current[activeSentenceRef.current.id];

          if (time >= activeSentenceRef.current.end - 0.05) {
            if (loopModeRef.current === 'one') {
              if (!isLoopDelayingRef.current) {
                isLoopDelayingRef.current = true;
                audioRef.current.pause();
                loopTimeoutRef.current = setTimeout(() => {
                  if (audioRef.current && loopModeRef.current === 'one' && activeSentenceRef.current) {
                    audioRef.current.currentTime = activeSentenceRef.current.start;
                    audioRef.current.play().catch(() => {});
                  }
                  isLoopDelayingRef.current = false;
                }, 500);
              }
            } else if (appModeRef.current === 'dictation' && !isCompleted) {
              audioRef.current.pause();
              audioRef.current.currentTime = activeSentenceRef.current.end - 0.05;
            } else if (appModeRef.current === 'shadowing') {
              audioRef.current.pause();
              audioRef.current.currentTime = activeSentenceRef.current.end - 0.05;
            }
          }
        }
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
  ]);
}
