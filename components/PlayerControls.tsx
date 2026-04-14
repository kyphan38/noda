import React from 'react';
import { Play, Pause, Gauge, Repeat, Repeat1, Video, VideoOff, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { LoopMode } from '@/types';
import { LOOP_MODE_LABELS } from '@/constants';

interface PlayerControlsProps {
  isPlaying: boolean;
  playbackRate: number;
  loopMode: LoopMode;
  onPlayPause: () => void;
  onSpeedChange: () => void;
  onLoopModeChange: () => void;
  /** Desktop video lesson: toggle picture visibility (audio keeps playing). */
  showVideoToggle?: boolean;
  videoHidden?: boolean;
  onToggleVideoHidden?: () => void;
  showCaptionsToggle?: boolean;
  captionsHidden?: boolean;
  onToggleCaptions?: () => void;
  showReset?: boolean;
  onReset?: () => void;
  compact?: boolean;
}

export function PlayerControls({
  isPlaying,
  playbackRate,
  loopMode,
  onPlayPause,
  onSpeedChange,
  onLoopModeChange,
  showVideoToggle = false,
  videoHidden = false,
  onToggleVideoHidden,
  showCaptionsToggle = false,
  captionsHidden = false,
  onToggleCaptions,
  showReset = false,
  onReset,
  compact = false,
}: PlayerControlsProps) {
  const buttonBase = compact
    ? 'px-2.5 py-1.5 rounded-md text-xs'
    : 'px-3 py-2 rounded-lg text-sm';
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 font-sans text-sm font-medium tracking-wide text-gray-300 ${compact ? 'text-xs' : ''}`}>
      <button
        onClick={onSpeedChange}
        className={`flex items-center gap-1.5 ${buttonBase} bg-gray-800/90 hover:bg-gray-700 text-gray-300 transition-colors`}
        title="Playback speed"
      >
        <Gauge className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0 text-blue-400`} />
        <span className="tabular-nums">{playbackRate.toFixed(2)}x</span>
      </button>

      <button
        onClick={onPlayPause}
        className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} shrink-0 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-transform active:scale-95`}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} fill-current`} />
        ) : (
          <Play className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} fill-current ml-0.5`} />
        )}
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {showCaptionsToggle && onToggleCaptions && (
          <button
            type="button"
            onClick={onToggleCaptions}
            className={`flex items-center gap-1.5 ${buttonBase} bg-gray-800/90 hover:bg-gray-700 text-gray-300 transition-colors`}
            title={captionsHidden ? 'Show captions' : 'Hide captions'}
          >
            {captionsHidden ? (
              <EyeOff className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
            ) : (
              <Eye className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
            )}
            <span className="hidden sm:inline">Captions</span>
          </button>
        )}
        {showVideoToggle && onToggleVideoHidden && (
          <button
            type="button"
            onClick={onToggleVideoHidden}
            className={`flex items-center gap-1.5 ${buttonBase} bg-gray-800/90 hover:bg-gray-700 text-gray-300 transition-colors`}
            title={videoHidden ? 'Show video' : 'Hide video'}
          >
            {videoHidden ? (
              <VideoOff className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
            ) : (
              <Video className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
            )}
            <span className="hidden sm:inline">Video</span>
          </button>
        )}
        {showReset && onReset && (
          <button
            type="button"
            onClick={onReset}
            className={`flex items-center gap-1.5 ${buttonBase} bg-gray-800/90 hover:bg-gray-700 text-gray-300 transition-colors`}
            title="Reset progress"
          >
            <RotateCcw className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
        <button
          onClick={onLoopModeChange}
          className={`${compact ? 'min-w-[6.75rem]' : 'min-w-[7.5rem]'} justify-center flex items-center gap-1.5 ${buttonBase} transition-colors ${
            loopMode !== 'none'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-800/90 hover:bg-gray-700 text-gray-300'
          }`}
          title="Loop (L)"
        >
          {loopMode === 'one' ? (
            <Repeat1 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
          ) : (
            <Repeat className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
          )}
          <span className="font-medium hidden sm:inline">{LOOP_MODE_LABELS[loopMode]}</span>
        </button>
      </div>
    </div>
  );
}
