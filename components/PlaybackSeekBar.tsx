import React from 'react';
import { formatTime } from '@/lib/utils';

interface PlaybackSeekBarProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  /** When true, seek input is non-interactive (e.g. media buffering). */
  seekDisabled?: boolean;
  compact?: boolean;
}

export function PlaybackSeekBar({
  duration,
  currentTime,
  onSeek,
  seekDisabled = false,
  compact = false,
}: PlaybackSeekBarProps) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2 mb-1' : 'gap-4 mb-6'}`}>
      <span className={`${compact ? 'text-xs w-10' : 'text-sm w-12'} font-mono tabular-nums text-gray-400 text-right`}>
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
        className={`flex-1 ${compact ? 'h-1.5' : 'h-2'} bg-gray-700 rounded-lg appearance-none accent-emerald-400 ${
          seekDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
        }`}
      />
      <span className={`${compact ? 'text-xs w-10' : 'text-sm w-12'} font-mono tabular-nums text-gray-400`}>
        {formatTime(duration)}
      </span>
    </div>
  );
}
