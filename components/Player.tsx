'use client';

import React from 'react';
import {
  Play,
  Pause,
  Gauge,
  Repeat,
  Repeat1,
  Video,
  VideoOff,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { LoopMode } from '@/types';
import { LOOP_MODE_LABELS } from '@/constants';
import { formatTime } from '@/lib/utils';

interface PlayerProps {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  loopMode: LoopMode;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: () => void;
  onLoopModeChange: () => void;
  seekDisabled?: boolean;
  showVideoToggle?: boolean;
  videoHidden?: boolean;
  onToggleVideoHidden?: () => void;
  showCaptionsToggle?: boolean;
  captionsHidden?: boolean;
  onToggleCaptions?: () => void;
  showReset?: boolean;
  onReset?: () => void;
}

const toolBtn =
  'flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white active:bg-gray-700';

export function Player({
  isPlaying,
  duration,
  currentTime,
  playbackRate,
  loopMode,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onLoopModeChange,
  seekDisabled = false,
  showVideoToggle = false,
  videoHidden = false,
  onToggleVideoHidden,
  showCaptionsToggle = false,
  captionsHidden = false,
  onToggleCaptions,
  showReset = false,
  onReset,
}: PlayerProps) {
  const loopLabel = LOOP_MODE_LABELS[loopMode] ?? 'Loop';
  const loopTitle =
    loopMode === 'none' ? 'Loop: off (click to cycle)' : `Loop: ${loopLabel} (click to cycle)`;

  return (
    <div
      className="flex h-14 sm:h-12 shrink-0 items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 px-2.5 font-sans sm:gap-3 sm:px-3"
      role="group"
      aria-label="Playback controls"
    >
      <button
        type="button"
        onClick={onPlayPause}
        className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 active:scale-95 active:bg-emerald-400"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" aria-hidden />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-gray-400 sm:w-10 sm:text-sm">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          disabled={seekDisabled}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Seek"
          className={`h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-emerald-400 sm:h-2 ${
            seekDisabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''
          }`}
        />
        <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-gray-400 sm:w-10 sm:text-sm">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onSpeedChange}
          className={toolBtn}
          aria-label={`Playback speed ${playbackRate.toFixed(2)} times`}
          title={`Playback speed (${playbackRate.toFixed(2)}×)`}
        >
          <Gauge className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onLoopModeChange}
          className={`${toolBtn} ${
            loopMode !== 'none'
              ? 'text-green-400 hover:bg-green-500/15 hover:text-green-300'
              : ''
          }`}
          aria-label={loopTitle}
          title={loopTitle}
        >
          {loopMode === 'one' ? (
            <Repeat1 className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Repeat className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </button>

        {showVideoToggle && onToggleVideoHidden && (
          <button
            type="button"
            onClick={onToggleVideoHidden}
            className={toolBtn}
            aria-label={videoHidden ? 'Show video' : 'Hide video'}
            title={videoHidden ? 'Show video' : 'Hide video'}
          >
            {videoHidden ? (
              <VideoOff className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Video className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </button>
        )}

        {showCaptionsToggle && onToggleCaptions && (
          <button
            type="button"
            onClick={onToggleCaptions}
            className={toolBtn}
            aria-label={captionsHidden ? 'Show captions' : 'Hide captions'}
            title={captionsHidden ? 'Show captions' : 'Hide captions'}
          >
            {captionsHidden ? (
              <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Eye className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </button>
        )}

        {showReset && onReset && (
          <button
            type="button"
            onClick={onReset}
            className={toolBtn}
            aria-label="Reset dictation progress"
            title="Reset dictation progress"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
