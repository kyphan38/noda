'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Player } from './Player';
import { Transcript } from './Transcript';
import { VideoPane } from './VideoPane';
import {
  LessonItem,
  AppMode,
  LoopMode,
  Sentence,
  DictationInputs,
  CompletedSentences,
} from '@/types';

const MemoPlayer = React.memo(Player);
const MemoTranscript = React.memo(Transcript);

interface LessonViewProps {
  lesson: LessonItem;
  mode: AppMode;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  loopMode: LoopMode;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: () => void;
  onLoopModeChange: () => void;
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
}

export function LessonView({
  lesson,
  mode,
  isPlaying,
  duration,
  currentTime,
  playbackRate,
  loopMode,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onLoopModeChange,
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
}: LessonViewProps) {
  const [seekDisabled, setSeekDisabled] = useState(false);
  const [videoHidden, setVideoHidden] = useState(false);
  const [hevcWarning, setHevcWarning] = useState(false);
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

  useEffect(() => {
    setVideoHidden(false);
    setHevcWarning(false);
  }, [lesson.id]);

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
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${videoLayout ? 'gap-4' : 'gap-3'}`}>
      {isVideoLesson && isMobile && mediaURL && (
        <p className="text-xs text-gray-400 text-center px-2 shrink-0">
          Video is hidden on small screens; audio and transcript still work.
        </p>
      )}

      {mediaURL && isVideoLesson && isMobile && (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaURL}
          playsInline
          preload="metadata"
          className="fixed w-px h-px opacity-0 -left-[9999px] pointer-events-none"
          {...mediaEvents}
        />
      )}

      {mediaURL && isVideoLesson && !isMobile && videoHidden && (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaURL}
          playsInline
          preload="metadata"
          className="fixed w-px h-px opacity-0 -left-[9999px] pointer-events-none"
          {...mediaEvents}
        />
      )}

      {mediaURL && isVideoLesson && !isMobile && showVideoStage && (
        <div className="relative shrink-0">
          <VideoPane
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaURL}
            videoHidden={false}
            onLoadedMetadata={mediaEvents.onLoadedMetadata}
            onEnded={mediaEvents.onEnded}
            onPlay={mediaEvents.onPlay}
            onPause={mediaEvents.onPause}
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
        <audio ref={mediaRef} src={mediaURL} className="hidden" {...mediaEvents} loop={false} />
      )}

      <div className={`flex flex-col flex-1 min-h-0 ${mediaURL ? 'gap-4' : ''}`}>
        {mediaURL && (
          <div>
            <MemoPlayer
              isPlaying={isPlaying}
              duration={duration}
              currentTime={currentTime}
              playbackRate={playbackRate}
              loopMode={loopMode}
              onPlayPause={onPlayPause}
              onSeek={onSeek}
              onSpeedChange={onSpeedChange}
              onLoopModeChange={onLoopModeChange}
              seekDisabled={seekDisabled}
              showVideoToggle={isVideoLesson}
              videoHidden={videoHidden}
              onToggleVideoHidden={toggleVideoHidden}
              showCaptionsToggle={mode === 'normal' && !!onToggleHideCaptions}
              captionsHidden={!!hideCaptions}
              onToggleCaptions={onToggleHideCaptions}
              showReset={mode === 'dictation' && !!onResetDictation}
              onReset={onResetDictation}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MemoTranscript
            transcript={transcript}
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
          />
        </div>
      </div>
    </div>
  );
}
