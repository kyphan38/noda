import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { AppMode, Sentence } from '@/types';
import { SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

type ModeChange = (mode: AppMode) => void | Promise<void>;

/**
 * Space / L / R / Ctrl replay-at-sentence-start, H toggles captions in normal mode, and ⌘1–3 mode switching for audio lessons.
 */
export function useGlobalPlaybackShortcuts(
  selectedItemType: 'lesson' | 'deck' | undefined,
  appMode: AppMode,
  toggleHideCaptions: (() => void) | undefined,
  handleModeChange: ModeChange,
  togglePlayPause: () => void,
  toggleLoopMode: () => void,
  loopTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  isLoopDelayingRef: MutableRefObject<boolean>,
  audioRef: RefObject<HTMLMediaElement | null>,
  activeSentenceRef: MutableRefObject<Sentence | null>,
  replayOnceRef: MutableRefObject<{ sentenceId: number; end: number } | null>
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
        if (e.key === '3') {
          e.preventDefault();
          void handleModeChange('shadowing');
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyL' || e.code === 'KeyR') {
        e.preventDefault();
        toggleLoopMode();
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
          const seekTarget = Math.max(0, activeSentenceRef.current.start - SENTENCE_PRE_ROLL_SECONDS);
          audioRef.current.currentTime = seekTarget;
          audioRef.current.play().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    togglePlayPause,
    toggleLoopMode,
    loopTimeoutRef,
    isLoopDelayingRef,
    audioRef,
    selectedItemType,
    appMode,
    toggleHideCaptions,
    handleModeChange,
    activeSentenceRef,
    replayOnceRef,
  ]);
}
