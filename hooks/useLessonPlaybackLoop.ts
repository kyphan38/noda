import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, LoopMode, RepeatCount, Sentence } from '@/types';
import { REPEAT_PAUSE_MS, SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

type RefBool = MutableRefObject<boolean>;
type RefMode = MutableRefObject<AppMode>;
type RefCompleted = MutableRefObject<Record<number, boolean>>;
type RefReplayOnce = MutableRefObject<{ sentenceId: number; end: number } | null>;

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
  replayOnceRef: RefReplayOnce,
  repeatCountRef: MutableRefObject<RepeatCount>,
  sentencePlayCountRef: MutableRefObject<number>
) {
  useEffect(() => {
    let animationFrameId: number;
    let lastActiveSentenceId: number | null = null;

    const updateProgress = () => {
      if (audioRef.current) {
        if (audioRef.current.seeking) {
          animationFrameId = requestAnimationFrame(updateProgress);
          return;
        }

        let time = audioRef.current.currentTime;

        const prevActiveSentenceId = lastActiveSentenceId;
        const currentSentence = transcript.find((s) => time >= s.start && time < s.end);
        activeSentenceRef.current = currentSentence ?? null;
        lastActiveSentenceId = currentSentence?.id ?? null;

        // Reset play count when active sentence changes
        if (currentSentence && prevActiveSentenceId !== null && currentSentence.id !== prevActiveSentenceId) {
          sentencePlayCountRef.current = 0;
        }

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
          const rpCount = repeatCountRef.current;
          const rpShouldRepeat = rpCount > 1 && sentencePlayCountRef.current < rpCount - 1;

          if (rpShouldRepeat && !isLoopDelayingRef.current) {
            isLoopDelayingRef.current = true;
            audioRef.current.pause();
            const seekTo = activeSentenceRef.current?.start ?? 0;
            loopTimeoutRef.current = setTimeout(() => {
              sentencePlayCountRef.current += 1;
              if (audioRef.current) {
                audioRef.current.currentTime = seekTo;
                audioRef.current.play().catch(() => {});
              }
              isLoopDelayingRef.current = false;
            }, REPEAT_PAUSE_MS);
          } else {
            audioRef.current.pause();
            time = replayOnceRef.current.end - 0.05;
            audioRef.current.currentTime = time;
            replayOnceRef.current = null;
            sentencePlayCountRef.current = 0;
          }
        } else if (activeSentenceRef.current) {
          if (time >= activeSentenceRef.current.end - 0.03) {
            const currentRepeatCount = repeatCountRef.current;
            const shouldRepeat = currentRepeatCount > 1 && sentencePlayCountRef.current < currentRepeatCount - 1;

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
                }, REPEAT_PAUSE_MS);
              }
            } else if (shouldRepeat) {
              if (!isLoopDelayingRef.current) {
                isLoopDelayingRef.current = true;
                audioRef.current.pause();
                loopTimeoutRef.current = setTimeout(() => {
                  sentencePlayCountRef.current += 1;
                  if (audioRef.current && activeSentenceRef.current) {
                    const preRoll = appModeRef.current === 'dictation' ? 0 : SENTENCE_PRE_ROLL_SECONDS;
                    audioRef.current.currentTime = Math.max(0, activeSentenceRef.current.start - preRoll);
                    audioRef.current.play().catch(() => {});
                  }
                  isLoopDelayingRef.current = false;
                }, REPEAT_PAUSE_MS);
              }
            } else if (appModeRef.current === 'dictation') {
              if (replayOnceRef.current && replayOnceRef.current.sentenceId !== activeSentenceRef.current.id) {
                // skip
              } else {
                audioRef.current.pause();
                time = activeSentenceRef.current.end - 0.03;
                audioRef.current.currentTime = time;
                sentencePlayCountRef.current = 0;
              }
            } else {
              sentencePlayCountRef.current = 0;
            }
          }
        } else if (appModeRef.current === 'dictation' && !audioRef.current.paused) {
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
    repeatCountRef,
    sentencePlayCountRef,
  ]);
}
