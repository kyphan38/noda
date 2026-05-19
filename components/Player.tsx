'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Gauge,
  Repeat,
  Video,
  VideoOff,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { RepeatCount } from '@/types';
import { formatTime } from '@/lib/utils';

interface PlayerProps {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  repeatCount: RepeatCount;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onRepeatCountChange: (count: RepeatCount) => void;
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

function SpeedPopover({
  speed,
  onChange,
  onClose,
}: {
  speed: number;
  onChange: (s: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 flex flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 shadow-lg min-w-[140px] sm:min-w-[120px]"
    >
      <span className="text-xs font-medium text-white tabular-nums">{speed.toFixed(1)}×</span>
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={speed}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-24 sm:w-20 h-1.5 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-400"
        aria-label="Playback speed"
      />
      <div className="flex justify-between w-24 sm:w-20">
        <span className="text-[10px] text-gray-500">0.0</span>
        <span className="text-[10px] text-gray-500">2.0</span>
      </div>
    </div>
  );
}

function RepeatPopover({
  count,
  onChange,
  onClose,
}: {
  count: RepeatCount;
  onChange: (c: RepeatCount) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const options: RepeatCount[] = [1, 2, 3];

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 flex items-center gap-1 rounded-xl border border-gray-700 bg-gray-900 px-2 py-2 shadow-lg"
    >
      {options.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => {
            onChange(n);
            onClose();
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
            count === n
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          aria-label={`Repeat ${n} time${n > 1 ? 's' : ''}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function Player({
  isPlaying,
  duration,
  currentTime,
  playbackRate,
  repeatCount,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onRepeatCountChange,
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
  const [showSpeedPopover, setShowSpeedPopover] = useState(false);
  const [showRepeatPopover, setShowRepeatPopover] = useState(false);

  const closeSpeed = useCallback(() => setShowSpeedPopover(false), []);
  const closeRepeat = useCallback(() => setShowRepeatPopover(false), []);

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
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowSpeedPopover((v) => !v);
              setShowRepeatPopover(false);
            }}
            className={toolBtn}
            aria-label={`Playback speed ${playbackRate.toFixed(1)}×`}
            title={`Playback speed (${playbackRate.toFixed(1)}×)`}
          >
            <Gauge className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
          </button>
          {showSpeedPopover && (
            <SpeedPopover speed={playbackRate} onChange={onSpeedChange} onClose={closeSpeed} />
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowRepeatPopover((v) => !v);
              setShowSpeedPopover(false);
            }}
            className={`${toolBtn} ${
              repeatCount > 1
                ? 'text-green-400 hover:bg-green-500/15 hover:text-green-300'
                : ''
            }`}
            aria-label={`Repeat ${repeatCount} time${repeatCount > 1 ? 's' : ''}`}
            title={`Repeat ${repeatCount}×`}
          >
            <Repeat className="h-4 w-4 shrink-0" aria-hidden />
          </button>
          {showRepeatPopover && (
            <RepeatPopover count={repeatCount} onChange={onRepeatCountChange} onClose={closeRepeat} />
          )}
        </div>

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
