'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Player, type PlayerAiButton } from './Player';
import { Transcript } from './Transcript';
import { VideoPane } from './VideoPane';
import { ShadowingPatternDock } from './ShadowingPatternDock';
import { ResumePrompt } from './ResumePrompt';
import type { ResumeTarget } from '@/lib/progress';
import type { PlaybackClock } from '@/lib/playbackClock';
import {
  LessonItem,
  AppMode,
  RepeatCount,
  Sentence,
  DictationInputs,
  CompletedSentences,
} from '@/types';
import { findActiveTranscriptIndex, scrollTranscriptRowIntoView } from '@/lib/transcript-scroll';
import { useShadowingPatternManager } from '@/hooks/useShadowingPatternManager';
import { useCoarsePointer } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const MemoPlayer = React.memo(Player);
const MemoTranscript = React.memo(Transcript);

interface LessonViewProps {
  lesson: LessonItem;
  /** Current lesson id + Firebase Storage media path, for the shadowing-pattern Cloud Function. */
  lessonId: string | null;
  mediaStoragePath: string | null;
  mode: AppMode;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  /** Frame-accurate playback time for the player's seek bar. */
  clock: PlaybackClock;
  playbackRate: number;
  repeatCount: RepeatCount;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onRepeatCountChange: (count: RepeatCount) => void;
  hideCaptions?: boolean;
  onToggleHideCaptions?: () => void;
  transcript: Sentence[];
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  shadowingCompleted: CompletedSentences;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  /** Shadowing: mark the active line done and play the next one (tap version of Enter). */
  onShadowingNext: () => void;
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  mediaURL: string | null;
  isMobile: boolean;
  setDuration: (d: number) => void;
  setIsPlaying: (v: boolean) => void;
  onMediaError?: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
  /** Notified whenever Focus Mode (single-line expanded video view) becomes active/inactive, so the page shell can widen to make room. */
  onFocusModeChange?: (active: boolean) => void;
  /** Saved spot to offer as "Continue", or null. */
  resumeTarget?: ResumeTarget | null;
  onResume?: () => void;
  onDismissResume?: () => void;
  /** Notified whenever the Shadowing Pattern analysis panel (side panel / bottom sheet) opens/closes, so the page shell can widen a bit to make room for the split. */
  onShadowingPanelOpenChange?: (open: boolean) => void;
}

export function LessonView({
  lesson,
  lessonId,
  mediaStoragePath,
  mode,
  isPlaying,
  duration,
  currentTime,
  clock,
  playbackRate,
  repeatCount,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onRepeatCountChange,
  transcript,
  dictationInputs,
  completedSentences,
  shadowingCompleted,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onShadowingNext,
  hideCaptions,
  onToggleHideCaptions,
  mediaRef,
  mediaURL,
  isMobile,
  setDuration,
  setIsPlaying,
  onMediaError,
  onFocusModeChange,
  resumeTarget,
  onResume,
  onDismissResume,
  onShadowingPanelOpenChange,
}: LessonViewProps) {
  const [seekDisabled, setSeekDisabled] = useState(false);
  const [videoHidden, setVideoHidden] = useState(false);
  const [hevcWarning, setHevcWarning] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const onFocusModeChangeRef = React.useRef(onFocusModeChange);
  const pendingToggleRestoreRef = React.useRef<{
    time: number;
    wasPlaying: boolean;
    rate: number;
  } | null>(null);
  const toggleVideoHidden = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      pendingToggleRestoreRef.current = {
        time: media.currentTime,
        wasPlaying: !media.paused,
        rate: media.playbackRate,
      };
    }
    setVideoHidden((v) => !v);
  }, [mediaRef]);

  const mediaType = lesson.mediaType ?? 'audio';
  const isVideoLesson = mediaType === 'video' && !!mediaURL;
  const videoLayout = isVideoLesson && !isMobile;
  const showVideoStage = videoLayout && !videoHidden;
  const showFocusToggle = mode !== 'dictation' && showVideoStage;
  const focusActive = focusMode && showFocusToggle;

  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), []);

  useEffect(() => {
    onFocusModeChangeRef.current = onFocusModeChange;
  }, [onFocusModeChange]);

  useEffect(() => {
    onFocusModeChangeRef.current?.(focusActive);
  }, [focusActive]);

  // Make sure the page shell is told to shrink back down if this view unmounts while still expanded.
  useEffect(() => {
    return () => onFocusModeChangeRef.current?.(false);
  }, []);

  const activeTranscriptIndex = useMemo(
    () => findActiveTranscriptIndex(currentTime, transcript),
    [currentTime, transcript]
  );
  const activeSentence =
    activeTranscriptIndex >= 0 ? transcript[activeTranscriptIndex] : undefined;

  // Shadowing-pattern explanation feature (Stage 7: centralized manager, side panel / bottom
  // sheet). Separate from the Shadowing tab's playback loop (auto-pause per line).
  const {
    activeSentenceId: activeShadowingSentenceId,
    isPanelOpen: isShadowingPanelOpen,
    getEntry: getShadowingEntry,
    open: openShadowingPanel,
    close: closeShadowingPanel,
    show: showShadowingSentence,
    analyze: analyzeShadowingSentence,
  } = useShadowingPatternManager(lessonId, mediaStoragePath, transcript);
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
  const touchControls = useCoarsePointer() || isMobile;
  const shadowingAvailable =
    mode !== 'dictation' && !hideCaptions && !!lessonId && !!mediaStoragePath && !focusActive;

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
  }, [lesson.id]);
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
  // cramped. Mirrors the `onFocusModeChange` ref pattern above.
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

  useEffect(() => {
    setVideoHidden(false);
    setHevcWarning(false);
    setFocusMode(false);
  }, [lesson.id]);

  useEffect(() => {
    if (!showFocusToggle) setFocusMode(false);
  }, [showFocusToggle]);

  useEffect(() => {
    setSeekDisabled(false);
  }, [mediaURL, lesson.id]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onWaiting = () => setSeekDisabled(true);
    const onReady = () => setSeekDisabled(false);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onReady);
    el.addEventListener('canplay', onReady);
    el.addEventListener('canplaythrough', onReady);
    return () => {
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onReady);
      el.removeEventListener('canplay', onReady);
      el.removeEventListener('canplaythrough', onReady);
    };
  }, [mediaURL, lesson.id, mediaRef]);

  useEffect(() => {
    if (!isVideoLesson || isMobile || !mediaURL) {
      setHevcWarning(false);
      return;
    }
    const el = mediaRef.current;
    if (!el || !(el instanceof HTMLVideoElement)) return;

    const check = () => {
      if (el.videoWidth > 0) setHevcWarning(false);
    };
    el.addEventListener('loadeddata', check);

    const timer = window.setTimeout(() => {
      if (mediaRef.current instanceof HTMLVideoElement && mediaRef.current.videoWidth === 0) {
        setHevcWarning(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('loadeddata', check);
    };
  }, [isVideoLesson, isMobile, mediaURL, lesson.id, mediaRef]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (Number.isFinite(playbackRate) && Math.abs(media.playbackRate - playbackRate) > 0.001) {
      media.playbackRate = playbackRate;
    }
  }, [lesson.id, mediaURL, videoHidden, showVideoStage, playbackRate, mediaRef]);

  const mediaEvents = {
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = e.currentTarget;
      setDuration(media.duration);

      const restore = pendingToggleRestoreRef.current;
      if (!restore) return;

      if (Number.isFinite(restore.rate) && Math.abs(media.playbackRate - restore.rate) > 0.001) {
        media.playbackRate = restore.rate;
      }

      if (Number.isFinite(restore.time) && restore.time >= 0) {
        try {
          const seekTarget =
            Number.isFinite(media.duration) && media.duration > 0
              ? Math.min(restore.time, Math.max(0, media.duration - 0.05))
              : restore.time;
          media.currentTime = seekTarget;
        } catch {
          // metadata can report duration before seekability; ignore
        }
      }

      if (restore.wasPlaying && media.paused) {
        media.play().catch(() => {});
      }

      pendingToggleRestoreRef.current = null;
    },
    onEnded: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onError: (e: React.SyntheticEvent<HTMLMediaElement>) => onMediaError?.(e),
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${videoLayout ? 'gap-4' : 'gap-3'}`}>
      {isVideoLesson && isMobile && mediaURL && (
        <p className="text-xs text-gray-500 text-center px-2 shrink-0">
          Video hidden on mobile - audio + transcript still work.
        </p>
      )}

      {mediaURL && isVideoLesson && isMobile && (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaURL}
          playsInline
          preload="auto"
          className="fixed w-px h-px opacity-0 -left-[9999px] pointer-events-none"
          {...mediaEvents}
        />
      )}

      {mediaURL && isVideoLesson && !isMobile && videoHidden && (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaURL}
          playsInline
          preload="auto"
          className="fixed w-px h-px opacity-0 -left-[9999px] pointer-events-none"
          {...mediaEvents}
        />
      )}

      {mediaURL && isVideoLesson && !isMobile && showVideoStage && (
        <div className={`relative ${focusActive ? 'flex-1 min-h-0' : 'shrink-0'}`}>
          <VideoPane
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaURL}
            videoHidden={false}
            expanded={focusActive}
            onLoadedMetadata={mediaEvents.onLoadedMetadata}
            onEnded={mediaEvents.onEnded}
            onPlay={mediaEvents.onPlay}
            onPause={mediaEvents.onPause}
            onError={mediaEvents.onError}
          />
          {hevcWarning && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-xs text-amber-200 px-3 text-center pointer-events-none rounded-2xl"
              role="status"
            >
              This file may not decode as video on this browser (e.g. HEVC). Audio still plays.
            </div>
          )}
        </div>
      )}

      {mediaURL && !isVideoLesson && (
        <audio ref={mediaRef} src={mediaURL} preload="auto" className="hidden" {...mediaEvents} loop={false} />
      )}

      {resumeTarget && onResume && onDismissResume && (
        <ResumePrompt
          target={resumeTarget}
          totalSentences={transcript.length}
          onResume={onResume}
          onDismiss={onDismissResume}
        />
      )}

      {focusActive ? (
        <div
          className="shrink-0 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-center min-h-[64px] text-center transition-all duration-200"
          aria-live="polite"
        >
          <p
            className={`font-sans text-base sm:text-lg leading-relaxed ${
              hideCaptions ? 'invisible select-none' : 'text-emerald-400 font-medium'
            }`}
          >
            {activeSentence ? activeSentence.text : ''}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'flex-1 min-h-0 flex overflow-hidden',
            isMobile && 'flex-col',
            isShadowingPanelOpen && (isMobile ? 'gap-2' : 'gap-3')
          )}
        >
          <div
            className={cn(
              'min-w-0',
              isMobile
                ? 'flex-1 min-h-0'
                : cn('h-full transition-[width] duration-300 ease-in-out', isShadowingPanelOpen ? 'flex-1' : 'w-full')
            )}
          >
            <MemoTranscript
              transcript={transcript}
              currentTime={currentTime}
              appMode={mode}
              hideCaptions={hideCaptions}
              dictationInputs={dictationInputs}
              completedSentences={completedSentences}
              shadowingCompleted={shadowingCompleted}
              scrollContainerRef={scrollContainerRef}
              onSentenceClick={onSentenceClick}
              onDictationChange={onDictationChange}
              onDictationKeyDown={onDictationKeyDown}
              onDictationRetry={onDictationRetry}
              onShadowingNext={onShadowingNext}
              isMobile={isMobile}
              touchControls={touchControls}
              activeShadowingSentenceId={activeShadowingSentenceId}
              isShadowingPanelOpen={isShadowingPanelOpen}
            />
          </div>
          {isMobile && (
            // Mobile: an in-flow dock between the transcript and the player, not a modal sheet.
            // The transcript above stays visible and scrollable and the player below stays usable,
            // so the learner can loop the line and read the analysis at the same time.
            <div
              className={cn(
                'shrink-0 flex flex-col overflow-hidden rounded-xl bg-gray-900 transition-[max-height] duration-300 ease-in-out',
                isShadowingPanelOpen ? 'max-h-[45dvh] border border-gray-800' : 'max-h-0'
              )}
            >
              {isShadowingPanelOpen && activeShadowingSentenceId != null && (
                <ShadowingPatternDock
                  key={activeShadowingSentenceId}
                  isMobile
                  entry={getShadowingEntry(activeShadowingSentenceId)}
                  sentenceText={activeShadowingSentence?.text ?? ''}
                  onClose={closeShadowingPanel}
                  onAnalyze={onAnalyzeShadowingSentence}
                />
              )}
            </div>
          )}
          {!isMobile && (
            <div
              className={cn(
                'h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
                isShadowingPanelOpen ? 'w-[30%] max-w-[320px] min-w-[240px]' : 'w-0'
              )}
            >
              {isShadowingPanelOpen && activeShadowingSentenceId != null && (
                <ShadowingPatternDock
                  key={activeShadowingSentenceId}
                  isMobile={false}
                  entry={getShadowingEntry(activeShadowingSentenceId)}
                  sentenceText={activeShadowingSentence?.text ?? ''}
                  onClose={closeShadowingPanel}
                  onAnalyze={onAnalyzeShadowingSentence}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Control bar: always the last item, so it stays pinned to the bottom of the screen in every mode. */}
      {mediaURL && (
        <div className="shrink-0">
          <MemoPlayer
            isPlaying={isPlaying}
            duration={duration}
            clock={clock}
            playbackRate={playbackRate}
            repeatCount={repeatCount}
            onPlayPause={onPlayPause}
            onSeek={onSeek}
            onSpeedChange={onSpeedChange}
            onRepeatCountChange={onRepeatCountChange}
            seekDisabled={seekDisabled}
            showVideoToggle={isVideoLesson}
            videoHidden={videoHidden}
            onToggleVideoHidden={toggleVideoHidden}
            showCaptionsToggle={mode !== 'dictation' && !!onToggleHideCaptions}
            captionsHidden={!!hideCaptions}
            onToggleCaptions={onToggleHideCaptions}
            showFocusToggle={showFocusToggle}
            focusMode={focusActive}
            onToggleFocusMode={showFocusToggle ? toggleFocusMode : undefined}
            ai={aiButton}
          />

        </div>
      )}
    </div>
  );
}
