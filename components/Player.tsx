'use client';

import React from 'react';
import { LoopMode } from '@/types';
import { PlaybackSeekBar } from './PlaybackSeekBar';
import { PlayerControls } from './PlayerControls';

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
  variant?: 'panel' | 'overlay';
}

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
  variant = 'panel',
}: PlayerProps) {
  const overlay = variant === 'overlay';
  return (
    <div className={overlay ? 'w-full' : 'bg-gray-900 rounded-2xl p-5 border border-gray-800 shrink-0'}>
      <PlaybackSeekBar
        duration={duration}
        currentTime={currentTime}
        onSeek={onSeek}
        seekDisabled={seekDisabled}
        compact={overlay}
      />
      <PlayerControls
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        loopMode={loopMode}
        onPlayPause={onPlayPause}
        onSpeedChange={onSpeedChange}
        onLoopModeChange={onLoopModeChange}
        showVideoToggle={showVideoToggle}
        videoHidden={videoHidden}
        onToggleVideoHidden={onToggleVideoHidden}
        showCaptionsToggle={showCaptionsToggle}
        captionsHidden={captionsHidden}
        onToggleCaptions={onToggleCaptions}
        showReset={showReset}
        onReset={onReset}
        compact={overlay}
      />
    </div>
  );
}
