import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, LoopMode, RepeatCount, Sentence } from '@/types';
import { REPEAT_PAUSE_MS, SEEK_SETTLE_TOLERANCE_S, SEEK_GUARD_TIMEOUT_MS } from '@/constants';
import { shouldRepeatSentenceAtEnd } from '@/lib/repeat-count';

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
  shadowingActiveRef: RefBool,
  completedSentencesRef: RefCompleted,
  activeSentenceRef: MutableRefObject<Sentence | null>,
  replayOnceRef: RefReplayOnce,
  repeatCountRef: MutableRefObject<RepeatCount>,
  sentencePlayCountRef: MutableRefObject<number>,
  userSeekTargetRef: MutableRefObject<number | null>
) {
  useEffect(() => {
    let animationFrameId: number;
    let lastActiveSentenceId: number | null = null;
    let lastSetTime: number | null = null;
    let seekGuardStartedAt: number | null = null;

    const updateProgress = () => {
      if (audioRef.current) {
        if (audioRef.current.seeking) {
          animationFrameId = requestAnimationFrame(updateProgress);
          return;
        }

        let time = audioRef.current.currentTime;

        // A user-initiated seek (click / Enter / Control replay in dictation) sets
        // `userSeekTargetRef` to the sentence we're jumping to. On some setups -
        // notably network-streamed media (Firebase Storage) rather than a local blob -
        // `currentTime`/`seeking` can lag a few animation frames behind the seek
        // assignment, so `time` here can still reflect the PRE-seek position for a
        // moment. Trusting that stale value would resolve `currentSentence` to the
        // sentence we just left, and the UI would flash back to it before snapping
        // forward once the seek actually lands. Skip processing this frame entirely
        // (without touching any state) until `time` catches up, bounded by a timeout
        // so a failed/cancelled seek can't wedge the loop forever.
        if (userSeekTargetRef.current !== null) {
          const seekTargetSentence = transcript.find((s) => s.id === userSeekTargetRef.current);
          if (seekTargetSentence && time < seekTargetSentence.start - SEEK_SETTLE_TOLERANCE_S) {
            if (seekGuardStartedAt === null) {
              seekGuardStartedAt = performance.now();
            }
            if (performance.now() - seekGuardStartedAt < SEEK_GUARD_TIMEOUT_MS) {
              animationFrameId = requestAnimationFrame(updateProgress);
              return;
            }
          } else if (seekGuardStartedAt !== null) {
            seekGuardStartedAt = null;
          }
        }

        // Right after a deliberate seek to a specific sentence (click / Enter / Control
        // replay in dictation), tiny seek inaccuracy - e.g. VBR MP3, or two sentences
        // sitting very close together - can land `time` slightly BEFORE the target's
        // start. Left as-is, the boundary scan below would then match the PREVIOUS
        // sentence and the UI would appear to snap back to it. Nudge `time` forward to
        // the intended start when it's within a small settle window.
        if (replayOnceRef.current) {
          const target = transcript.find((s) => s.id === replayOnceRef.current!.sentenceId);
          if (target && time < target.start && time >= target.start - SEEK_SETTLE_TOLERANCE_S) {
            time = target.start;
          }
        }

        const prevActiveSentenceId = lastActiveSentenceId;
        const currentSentence = transcript.find((s) => time >= s.start && time < s.end);
        activeSentenceRef.current = currentSentence ?? null;
        lastActiveSentenceId = currentSentence?.id ?? null;

        if (currentSentence?.id !== prevActiveSentenceId) {
        }

        // Reset play count when active sentence changes
        if (currentSentence && prevActiveSentenceId !== null && currentSentence.id !== prevActiveSentenceId) {
          sentencePlayCountRef.current = 0;
        }

        // Clear user seek target once the target sentence becomes active
        if (currentSentence && userSeekTargetRef.current === currentSentence.id) {
          userSeekTargetRef.current = null;
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
          const rpShouldRepeat = shouldRepeatSentenceAtEnd(
            repeatCountRef.current,
            sentencePlayCountRef.current
          );

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
            const shouldRepeat = shouldRepeatSentenceAtEnd(
              repeatCountRef.current,
              sentencePlayCountRef.current
            );

            if (loopModeRef.current === 'one' && userSeekTargetRef.current === null) {
              if (!isLoopDelayingRef.current) {
                isLoopDelayingRef.current = true;
                audioRef.current.pause();
                loopTimeoutRef.current = setTimeout(() => {
                  if (audioRef.current && loopModeRef.current === 'one' && activeSentenceRef.current) {
                    audioRef.current.currentTime = activeSentenceRef.current.start;
                    audioRef.current.play().catch(() => {});
                  }
                  isLoopDelayingRef.current = false;
                }, REPEAT_PAUSE_MS);
              }
            } else if (shouldRepeat && userSeekTargetRef.current === null) {
              if (!isLoopDelayingRef.current) {
                isLoopDelayingRef.current = true;
                audioRef.current.pause();
                loopTimeoutRef.current = setTimeout(() => {
                  sentencePlayCountRef.current += 1;
                  if (audioRef.current && activeSentenceRef.current) {
                    audioRef.current.currentTime = activeSentenceRef.current.start;
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
            } else if (shadowingActiveRef.current && appModeRef.current === 'normal') {
              // Shadowing: stop after each line instead of continuing to the next one.
              // Press Enter to advance, or Control to replay the current line.
              audioRef.current.pause();
              time = activeSentenceRef.current.end - 0.03;
              audioRef.current.currentTime = time;
              sentencePlayCountRef.current = 0;
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

        if (time !== lastSetTime) {
          lastSetTime = time;
          setCurrentTime(time);
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
    shadowingActiveRef,
    completedSentencesRef,
    audioRef,
    activeSentenceRef,
    replayOnceRef,
    repeatCountRef,
    sentencePlayCountRef,
    userSeekTargetRef,
  ]);
}
