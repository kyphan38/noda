'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { PlayerAiButton } from '@/components/Player';
import { useShadowingPatternManager } from '@/hooks/useShadowingPatternManager';
import type { ShadowingMediaSource } from '@/lib/shadowingAnalysis';
import { scrollTranscriptRowIntoView } from '@/lib/transcript-scroll';
import type { AppMode, Sentence } from '@/types';

type Options = {
  lessonId: string | null;
  lessonKey: string;
  aiMediaSource: ShadowingMediaSource | null;
  transcript: Sentence[];
  mode: AppMode;
  hideCaptions?: boolean;
  focusActive: boolean;
  isMobile: boolean;
  currentTime: number;
  activeSentence: Sentence | undefined;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onShadowingPanelOpenChange?: (open: boolean) => void;
};

/**
 * The shadowing-pattern AI panel inside a lesson: which sentence it follows, the player's
 * AI button, the "A" shortcut, and telling the page shell when the panel opens.
 * Separate from the Shadowing tab's playback loop (auto-pause per line).
 */
export function useShadowingAiPanel({
  lessonId,
  lessonKey,
  aiMediaSource,
  transcript,
  mode,
  hideCaptions,
  focusActive,
  isMobile,
  currentTime,
  activeSentence,
  scrollContainerRef,
  onShadowingPanelOpenChange,
}: Options) {
  const {
    activeSentenceId: activeShadowingSentenceId,
    isPanelOpen: isShadowingPanelOpen,
    getEntry: getShadowingEntry,
    open: openShadowingPanel,
    close: closeShadowingPanel,
    show: showShadowingSentence,
    analyze: analyzeShadowingSentence,
    autoAnalyze: shadowingAutoAnalyze,
    autoStopped: shadowingAutoStopped,
    setAutoAnalyze: setShadowingAutoAnalyze,
  } = useShadowingPatternManager(lessonId, aiMediaSource, transcript);
  const activeShadowingSentence =
    activeShadowingSentenceId != null
      ? transcript.find((s) => s.id === activeShadowingSentenceId)
      : undefined;
  const onAnalyzeShadowingSentence = useCallback(() => {
    if (activeShadowingSentence) analyzeShadowingSentence(activeShadowingSentence);
  }, [activeShadowingSentence, analyzeShadowingSentence]);

  // The player's AI button opens and closes the panel; while open, the panel follows the
  // sentence being played. Hidden where the analysis would give away text the mode keeps
  // hidden (Dictation, captions off) and in focus mode, which has no room for the panel.
  const shadowingAvailable =
    mode !== 'dictation' && !hideCaptions && !!lessonId && !!aiMediaSource && !focusActive;

  // The sentence the panel follows. Only a sentence that is really playing replaces it: at a
  // sentence's end (the loop's pause) and during Ctrl's 0.1s pre-roll the time sits in a gap,
  // where `activeSentence` already points at the NEXT sentence - following that would flick
  // the panel to the next line and back on every loop.
  const playingSentenceId =
    activeSentence && currentTime >= activeSentence.start && currentTime < activeSentence.end
      ? activeSentence.id
      : null;
  const [followedSentenceId, setFollowedSentenceId] = useState<number | null>(null);
  useEffect(() => {
    if (playingSentenceId != null) setFollowedSentenceId(playingSentenceId);
  }, [playingSentenceId]);
  useEffect(() => {
    setFollowedSentenceId(null);
  }, [lessonKey]);
  const followedSentence = useMemo(
    () =>
      (followedSentenceId != null ? transcript.find((s) => s.id === followedSentenceId) : undefined) ??
      activeSentence,
    [followedSentenceId, transcript, activeSentence]
  );
  const currentAiSentence = shadowingAvailable ? followedSentence : undefined;

  // Free cache lookup for the current sentence (open or not, so the button can show
  // "already analyzed"); with the panel open, also move the panel to it.
  useEffect(() => {
    if (currentAiSentence) showShadowingSentence(currentAiSentence, { follow: isShadowingPanelOpen });
  }, [currentAiSentence, isShadowingPanelOpen, showShadowingSentence]);

  // Leaving Shadowing/Listen (or hiding captions) closes the panel rather than leaving it on
  // a sentence the mode is meant to hide.
  useEffect(() => {
    if (!shadowingAvailable && isShadowingPanelOpen) closeShadowingPanel();
  }, [shadowingAvailable, isShadowingPanelOpen, closeShadowingPanel]);

  const onAiClick = useCallback(() => {
    if (isShadowingPanelOpen) closeShadowingPanel();
    else if (currentAiSentence) openShadowingPanel(currentAiSentence);
  }, [isShadowingPanelOpen, currentAiSentence, closeShadowingPanel, openShadowingPanel]);

  // "A" toggles the panel, like the player button.
  useEffect(() => {
    if (!shadowingAvailable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyA' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLElement && el.isContentEditable) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      onAiClick();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shadowingAvailable, onAiClick]);

  const currentAiEntry = currentAiSentence ? getShadowingEntry(currentAiSentence.id) : null;
  const aiButton = useMemo<PlayerAiButton | undefined>(
    () =>
      shadowingAvailable
        ? {
            onClick: onAiClick,
            active: isShadowingPanelOpen,
            loading: currentAiEntry?.status === 'loading',
            cached: currentAiEntry?.status === 'ready',
            disabled: !currentAiSentence,
          }
        : undefined,
    [shadowingAvailable, onAiClick, isShadowingPanelOpen, currentAiSentence, currentAiEntry]
  );

  // Tell the page shell to widen a bit while the panel is open, so the 60/40 split isn't
  // cramped. Same ref pattern as LessonView's `onFocusModeChange`.
  const onShadowingPanelOpenChangeRef = React.useRef(onShadowingPanelOpenChange);
  useEffect(() => {
    onShadowingPanelOpenChangeRef.current = onShadowingPanelOpenChange;
  }, [onShadowingPanelOpenChange]);
  useEffect(() => {
    onShadowingPanelOpenChangeRef.current?.(isShadowingPanelOpen);
  }, [isShadowingPanelOpen]);
  // Make sure the page shell is told to shrink back down if this view unmounts while still open.
  useEffect(() => {
    return () => onShadowingPanelOpenChangeRef.current?.(false);
  }, []);

  // Mobile: the dock takes the bottom of the transcript area, which can hide the sentence it
  // is about. Re-centre that row once the dock has finished growing (300ms transition). Only
  // on opening: after that the panel follows playback and the normal auto-scroll keeps the
  // playing row in view.
  const activeShadowingSentenceIdRef = React.useRef(activeShadowingSentenceId);
  activeShadowingSentenceIdRef.current = activeShadowingSentenceId;
  useEffect(() => {
    if (!isMobile || !isShadowingPanelOpen) return;
    const timer = window.setTimeout(() => {
      const index = transcript.findIndex((s) => s.id === activeShadowingSentenceIdRef.current);
      if (index !== -1 && scrollContainerRef.current) {
        scrollTranscriptRowIntoView(scrollContainerRef.current, index, 'smooth');
      }
    }, 320);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on open only, not on every followed sentence
  }, [isMobile, isShadowingPanelOpen]);

  return {
    activeShadowingSentenceId,
    activeShadowingSentence,
    isShadowingPanelOpen,
    getShadowingEntry,
    closeShadowingPanel,
    onAnalyzeShadowingSentence,
    shadowingAutoAnalyze,
    shadowingAutoStopped,
    setShadowingAutoAnalyze,
    aiButton,
  };
}
