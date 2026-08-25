import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, RepeatCount, Sentence } from '@/types';
import { ARROW_SKIP_SECONDS, SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

type ModeChange = (mode: AppMode) => void | Promise<void>;

export function useGlobalPlaybackShortcuts(
  selectedItemType: 'lesson' | 'deck' | undefined,
  appMode: AppMode,
  toggleHideCaptions: (() => void) | undefined,
  handleModeChange: ModeChange,
  togglePlayPause: () => void,
  cycleRepeatCount: () => void,
  loopTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  isLoopDelayingRef: MutableRefObject<boolean>,
  audioRef: RefObject<HTMLMediaElement | null>,
  activeSentenceRef: MutableRefObject<Sentence | null>,
  replayOnceRef: MutableRefObject<{ sentenceId: number; end: number } | null>,
  shadowingActiveRef: MutableRefObject<boolean>,
  onShadowingNext: () => void,
  transcriptRef: MutableRefObject<Sentence[]>,
  userSeekTargetRef: MutableRefObject<number | null>
) {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }
      if (t instanceof HTMLElement && t.isContentEditable) {
        return;
      }
      const ae = document.activeElement;
      if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) {
        return;
      }
      if (ae instanceof HTMLElement && ae.isContentEditable) {
        return;
      }

      if (
        e.code === 'KeyH' &&
        selectedItemType === 'lesson' &&
        appMode === 'normal' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleHideCaptions?.();
        return;
      }

      if (selectedItemType === 'lesson' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          void handleModeChange('normal');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          void handleModeChange('dictation');
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const media = audioRef.current;
        if (media && Number.isFinite(media.currentTime)) {
          const delta = e.code === 'ArrowLeft' ? -ARROW_SKIP_SECONDS : ARROW_SKIP_SECONDS;
          const maxTime = Number.isFinite(media.duration) ? media.duration : Infinity;
          media.currentTime = Math.min(Math.max(0, media.currentTime + delta), maxTime);
        }
      } else if (e.code === 'KeyL' || e.code === 'KeyR') {
        e.preventDefault();
        cycleRepeatCount();
      } else if (e.key === 'Enter' && shadowingActiveRef.current && appMode === 'normal') {
        e.preventDefault();
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          isLoopDelayingRef.current = false;
        }
        onShadowingNext();
      } else if (e.key === 'Control') {
        e.preventDefault();
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          isLoopDelayingRef.current = false;
        }
        if (audioRef.current && activeSentenceRef.current) {
          if (appMode === 'dictation') {
            replayOnceRef.current = { sentenceId: activeSentenceRef.current.id, end: activeSentenceRef.current.end };
          }
          const preRoll = appMode === 'dictation' ? 0 : SENTENCE_PRE_ROLL_SECONDS;
          // Same clamp as handleSentenceClick in page.tsx: the pre-roll lead-in
          // must never land inside the PREVIOUS sentence's own cue window, or the
          // playback loop will resolve "current sentence" as the previous one and
          // immediately re-trigger its pause-at-end behavior.
          const tr = transcriptRef.current;
          const idx = tr.findIndex((s) => s.id === activeSentenceRef.current!.id);
          const prevSentence = idx > 0 ? tr[idx - 1] : null;
          const minSeekTarget = prevSentence ? prevSentence.end : 0;
          const seekTarget = Math.max(minSeekTarget, activeSentenceRef.current.start - preRoll);
          userSeekTargetRef.current = activeSentenceRef.current.id;
          audioRef.current.currentTime = seekTarget;
          audioRef.current.play().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    togglePlayPause,
    cycleRepeatCount,
    loopTimeoutRef,
    isLoopDelayingRef,
    audioRef,
    selectedItemType,
    appMode,
    toggleHideCaptions,
    handleModeChange,
    activeSentenceRef,
    replayOnceRef,
    shadowingActiveRef,
    onShadowingNext,
    transcriptRef,
    userSeekTargetRef,
  ]);
}
