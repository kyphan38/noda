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
  SpokenResult,
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
  isRecording: number | null;
  spokenResults: Record<number, SpokenResult>;
  recognitionErrors: Record<number, string>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
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
  isRecording,
  spokenResults,
  recognitionErrors,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onToggleRecording,
  onSkip,
  onSimulateSuccess,
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
  const [videoHovered, setVideoHovered] = useState(false);

  const toggleVideoHidden = useCallback(() => {
    setVideoHidden((v) => !v);
  }, []);

  const mediaType = lesson.mediaType ?? 'audio';
  const isVideoLesson = mediaType === 'video' && !!mediaURL;
  const videoLayout = isVideoLesson && !isMobile;
  const showOverlayControls = videoHidden || !isPlaying || videoHovered;

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

  const mediaEvents = {
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => setDuration(e.currentTarget.duration),
    onEnded: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${videoLayout ? 'gap-2' : 'gap-3'}`}>
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

      {mediaURL && isVideoLesson && !isMobile && (
        <div
          className="relative shrink-0"
          onMouseEnter={() => setVideoHovered(true)}
          onMouseLeave={() => setVideoHovered(false)}
        >
          <VideoPane
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaURL}
            videoHidden={videoHidden}
            onLoadedMetadata={mediaEvents.onLoadedMetadata}
            onEnded={mediaEvents.onEnded}
            onPlay={mediaEvents.onPlay}
            onPause={mediaEvents.onPause}
          />
          <div
            className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
              showOverlayControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="px-3 pb-2 pt-6 bg-gradient-to-t from-black/85 via-black/35 to-transparent rounded-b-xl">
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
                showVideoToggle
                videoHidden={videoHidden}
                onToggleVideoHidden={toggleVideoHidden}
                showCaptionsToggle={mode === 'normal' && !!onToggleHideCaptions}
                captionsHidden={!!hideCaptions}
                onToggleCaptions={onToggleHideCaptions}
                showReset={mode === 'dictation' && !!onResetDictation}
                onReset={onResetDictation}
                variant="overlay"
              />
            </div>
          </div>
          {hevcWarning && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/75 text-xs text-amber-200 px-3 text-center pointer-events-none rounded-xl"
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

      <div className={videoLayout ? 'flex flex-col flex-1 min-h-0' : 'flex flex-col flex-1 min-h-0 gap-3'}>
        {!videoLayout && (
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
        )}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MemoTranscript
            transcript={transcript}
            currentTime={currentTime}
            isPlaying={isPlaying}
            appMode={mode}
            hideCaptions={hideCaptions}
            onToggleHideCaptions={onToggleHideCaptions}
            onResetDictation={onResetDictation}
            dictationInputs={dictationInputs}
            completedSentences={completedSentences}
            isRecording={isRecording}
            spokenResults={spokenResults}
            recognitionErrors={recognitionErrors}
            scrollContainerRef={scrollContainerRef}
            onSentenceClick={onSentenceClick}
            onDictationChange={onDictationChange}
            onDictationKeyDown={onDictationKeyDown}
            onDictationRetry={onDictationRetry}
            onToggleRecording={onToggleRecording}
            onSkip={onSkip}
            onSimulateSuccess={onSimulateSuccess}
          />
        </div>
      </div>
    </div>
  );
}
