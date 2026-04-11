'use client';

import React from 'react';
import { Play, Pause, Gauge, Repeat, Repeat1 } from 'lucide-react';
import { AppMode, LoopMode } from '@/types';
import { formatTime } from '@/lib/utils';
import { LOOP_MODE_LABELS } from '@/constants';

interface PlayerProps {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  appMode: AppMode;
  loopMode: LoopMode;
  isGeneratingIPA: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: () => void;
  onModeChange: (mode: AppMode) => void;
  onLoopModeChange: () => void;
}

export function Player({
  isPlaying,
  duration,
  currentTime,
  playbackRate,
  appMode,
  loopMode,
  isGeneratingIPA,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onModeChange,
  onLoopModeChange,
}: PlayerProps) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800 shrink-0">
      {/* Progress Bar */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-mono text-gray-400 w-12 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
        <span className="text-sm font-mono text-gray-400 w-12">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Speed Control */}
        <button
          onClick={onSpeedChange}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          title="Playback Speed"
        >
          <Gauge className="w-5 h-5 text-blue-400" />
          <span className="font-medium font-mono">{playbackRate.toFixed(2)}x</span>
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="w-14 h-14 flex items-center justify-center rounded-full bg-emerald-400 hover:bg-yellow-300 text-gray-950 transition-transform active:scale-95 shadow-lg shadow-emerald-400/20"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </button>

        {/* Mode Selector */}
        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
          <button
            onClick={() => onModeChange('normal')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              appMode === 'normal'
                ? 'bg-gray-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => onModeChange('dictation')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              appMode === 'dictation'
                ? 'bg-purple-500/40 text-purple-100 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Dictation
          </button>
          <button
            onClick={() => onModeChange('shadowing')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              appMode === 'shadowing'
                ? 'bg-green-500/40 text-green-100 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {isGeneratingIPA && appMode === 'shadowing' && (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            Shadowing
          </button>
        </div>

        {/* Loop Control */}
        <button
          onClick={onLoopModeChange}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            loopMode !== 'none'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-transparent'
          }`}
          title="Loop Mode (Shortcut: L)"
        >
          {loopMode === 'one' ? (
            <Repeat1 className="w-5 h-5" />
          ) : (
            <Repeat className={`w-5 h-5 ${loopMode === 'all' ? 'text-green-400' : ''}`} />
          )}
          <span className="font-medium hidden sm:inline">{LOOP_MODE_LABELS[loopMode]}</span>
        </button>
      </div>
    </div>
  );
}
