'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Player } from './Player';
import { Transcript } from './Transcript';
import { VideoPane } from './VideoPane';
import { ShadowingPatternDock } from './ShadowingPatternDock';
import {
  LessonItem,
  AppMode,
  RepeatCount,
  Sentence,
  DictationInputs,
  CompletedSentences,
} from '@/types';
import { findActiveTranscriptIndex } from '@/lib/transcript-scroll';
import { useShadowingPatternManager } from '@/hooks/useShadowingPatternManager';
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
  playbackRate: number;
  repeatCount: RepeatCount;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onRepeatCountChange: (count: RepeatCount) => void;
  onResetDictation?: () => void;
  hideCaptions?: boolean;
  onToggleHideCaptions?: () => void;
  transcript: Sentence[];
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  mediaURL: string | null;
  isMobile: boolean;
  setDuration: (d: number) => void;
  setIsPlaying: (v: boolean) => void;
  onMediaError?: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
  /** Notified whenever Focus Mode (single-line expanded video view) becomes active/inactive, so the page shell can widen to make room. */
  onFocusModeChange?: (active: boolean) => void;
  /** Shadowing practice (Normal mode only): pauses after each line; Enter = next line, Control = replay line. */
  shadowingActive?: boolean;
  onToggleShadowing?: () => void;
  /** Notified whenever the Shadowing Pattern analysis panel (side panel / bottom sheet) opens/closes, so the page shell can widen a bit to make room for the split. Distinct from `shadowingActive` above. */
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
  playbackRate,
  repeatCount,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onRepeatCountChange,
  transcript,
  dictationInputs,
  completedSentences,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onResetDictation,
  hideCaptions,
  onToggleHideCaptions,
  mediaRef,
  mediaURL,
  isMobile,
  setDuration,
  setIsPlaying,
  onMediaError,
  onFocusModeChange,
  shadowingActive,
  onToggleShadowing,
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
  const showFocusToggle = mode === 'normal' && showVideoStage;
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
  // sheet). Named distinctly from `shadowingActive`/`onToggleShadowing` above, which control
  // the unrelated Player "shadowing mode" playback loop (auto-pause per line).
  const {
    activeSentenceId: activeShadowingSentenceId,
    isPanelOpen: isShadowingPanelOpen,
    confirmingSentenceId: confirmingShadowingSentenceId,
    getEntry: getShadowingEntry,
    handleSparkleClick: onSparkleClick,
    confirmGenerate: onConfirmShadowingGenerate,
    cancelConfirm: onCancelShadowingConfirm,
    close: closeShadowingPanel,
    retry: retryShadowingAnalysis,
  } = useShadowingPatternManager(lessonId, mediaStoragePath);
  const activeShadowingSentence =
    activeShadowingSentenceId != null
      ? transcript.find((s) => s.id === activeShadowingSentenceId)
      : undefined;
  const onRetryShadowingAnalysis = useCallback(() => {
    if (activeShadowingSentence) retryShadowingAnalysis(activeShadowingSentence);
  }, [activeShadowingSentence, retryShadowingAnalysis]);

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
        <div className={cn('flex-1 min-h-0 flex overflow-hidden', isShadowingPanelOpen && 'gap-3')}>
          <div
            className={cn(
              'h-full min-w-0 transition-[width] duration-300 ease-in-out',
              isShadowingPanelOpen ? 'flex-1' : 'w-full'
            )}
          >
            <MemoTranscript
              transcript={transcript}
              lessonId={lessonId}
              mediaStoragePath={mediaStoragePath}
              currentTime={currentTime}
              appMode={mode}
              hideCaptions={hideCaptions}
              dictationInputs={dictationInputs}
              completedSentences={completedSentences}
              scrollContainerRef={scrollContainerRef}
              onSentenceClick={onSentenceClick}
              onDictationChange={onDictationChange}
              onDictationKeyDown={onDictationKeyDown}
              onDictationRetry={onDictationRetry}
              isMobile={isMobile}
              activeShadowingSentenceId={activeShadowingSentenceId}
              isShadowingPanelOpen={isShadowingPanelOpen}
              confirmingShadowingSentenceId={confirmingShadowingSentenceId}
              getShadowingEntry={getShadowingEntry}
              onSparkleClick={onSparkleClick}
              onConfirmShadowingGenerate={onConfirmShadowingGenerate}
              onCancelShadowingConfirm={onCancelShadowingConfirm}
            />
          </div>
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
                  onClose={closeShadowingPanel}
                  onRetry={onRetryShadowingAnalysis}
                />
              )}
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <div
          className={cn(
            'fixed inset-0 z-[215] flex items-end',
            isShadowingPanelOpen ? '' : 'pointer-events-none'
          )}
        >
          <div
            className={cn(
              'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
              isShadowingPanelOpen ? 'opacity-100' : 'opacity-0'
            )}
            onClick={closeShadowingPanel}
          />
          <div
            className={cn(
              'relative w-full max-h-[70vh] bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 ease-in-out',
              isShadowingPanelOpen ? 'translate-y-0' : 'translate-y-full'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isShadowingPanelOpen && activeShadowingSentenceId != null && (
              <ShadowingPatternDock
                key={activeShadowingSentenceId}
                isMobile
                entry={getShadowingEntry(activeShadowingSentenceId)}
                onClose={closeShadowingPanel}
                onRetry={onRetryShadowingAnalysis}
              />
            )}
          </div>
        </div>
      )}

      {/* Control bar: always the last item, so it stays pinned to the bottom of the screen in every mode. */}
      {mediaURL && (
        <div className="shrink-0">
          <MemoPlayer
            isPlaying={isPlaying}
            duration={duration}
            currentTime={currentTime}
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
            showCaptionsToggle={mode === 'normal' && !!onToggleHideCaptions}
            captionsHidden={!!hideCaptions}
            onToggleCaptions={onToggleHideCaptions}
            showFocusToggle={showFocusToggle}
            focusMode={focusActive}
            onToggleFocusMode={showFocusToggle ? toggleFocusMode : undefined}
            showShadowingToggle={mode === 'normal' && !!onToggleShadowing}
            shadowingActive={!!shadowingActive}
            onToggleShadowing={mode === 'normal' ? onToggleShadowing : undefined}
            showReset={mode === 'dictation' && !!onResetDictation}
            onReset={onResetDictation}
          />
        </div>
      )}
    </div>
  );
}
