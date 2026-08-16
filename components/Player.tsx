'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Infinity,
  Maximize2,
  Minimize2,
  Ear,
} from 'lucide-react';
import { RepeatCount } from '@/types';
import {
  REPEAT_COUNT_OPTIONS,
  isRepeatCountActive,
  repeatCountAriaLabel,
  repeatCountTitle,
  repeatOptionAriaLabel,
} from '@/lib/repeat-count';
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
  showFocusToggle?: boolean;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  showShadowingToggle?: boolean;
  shadowingActive?: boolean;
  onToggleShadowing?: () => void;
  showReset?: boolean;
  onReset?: () => void;
}

const toolBtn =
  'flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white active:bg-gray-700';

function usePopoverPosition(
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  isOpen: boolean
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: rect.top - 6,
        left: rect.left + rect.width / 2,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, triggerRef]);

  return pos;
}

function SpeedPopover({
  speed,
  onChange,
  onClose,
  triggerRef,
}: {
  speed: number;
  onChange: (s: number) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(triggerRef, true);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, triggerRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
      }}
      className="z-[9999] flex flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 shadow-lg min-w-[140px] sm:min-w-[120px]"
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
    </div>,
    document.body
  );
}

function RepeatPopover({
  count,
  onChange,
  onClose,
  triggerRef,
}: {
  count: RepeatCount;
  onChange: (c: RepeatCount) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(triggerRef, true);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, triggerRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
      }}
      className="z-[9999] flex items-center gap-1 rounded-xl border border-gray-700 bg-gray-900 px-2 py-2 shadow-lg"
    >
      {REPEAT_COUNT_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          data-repeat-option={n}
          onClick={() => {
            onChange(n);
            onClose();
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
            count === n
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          aria-label={repeatOptionAriaLabel(n)}
        >
          {n === 'infinite' ? (
            <Infinity className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          ) : (
            n
          )}
        </button>
      ))}
    </div>,
    document.body
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
  showFocusToggle = false,
  focusMode = false,
  onToggleFocusMode,
  showShadowingToggle = false,
  shadowingActive = false,
  onToggleShadowing,
  showReset = false,
  onReset,
}: PlayerProps) {
  const [showSpeedPopover, setShowSpeedPopover] = useState(false);
  const [showRepeatPopover, setShowRepeatPopover] = useState(false);

  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const repeatBtnRef = useRef<HTMLButtonElement>(null);

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
        <button
          ref={speedBtnRef}
          type="button"
          onClick={() => {
            setShowSpeedPopover((v) => !v);
            setShowRepeatPopover(false);
          }}
          className={`${toolBtn} ${showSpeedPopover ? 'bg-gray-800 text-white' : ''}`}
          aria-label={`Playback speed ${playbackRate.toFixed(1)}×`}
          title={`Playback speed (${playbackRate.toFixed(1)}×)`}
        >
          <Gauge className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
        </button>
        {showSpeedPopover && (
          <SpeedPopover
            speed={playbackRate}
            onChange={onSpeedChange}
            onClose={closeSpeed}
            triggerRef={speedBtnRef}
          />
        )}

        <button
          ref={repeatBtnRef}
          type="button"
          data-repeat-trigger
          onClick={() => {
            setShowRepeatPopover((v) => !v);
            setShowSpeedPopover(false);
          }}
          className={`${toolBtn} ${
            isRepeatCountActive(repeatCount)
              ? 'text-green-400 hover:bg-green-500/15 hover:text-green-300'
              : ''
          } ${showRepeatPopover ? 'bg-gray-800' : ''}`}
          aria-label={repeatCountAriaLabel(repeatCount)}
          title={repeatCountTitle(repeatCount)}
        >
          <Repeat className="h-4 w-4 shrink-0" aria-hidden />
        </button>
        {showRepeatPopover && (
          <RepeatPopover
            count={repeatCount}
            onChange={onRepeatCountChange}
            onClose={closeRepeat}
            triggerRef={repeatBtnRef}
          />
        )}

        {showShadowingToggle && onToggleShadowing && (
          <button
            type="button"
            onClick={onToggleShadowing}
            className={`${toolBtn} ${shadowingActive ? 'bg-gray-800 text-white' : ''}`}
            aria-label={shadowingActive ? 'Turn off shadowing mode' : 'Turn on shadowing mode'}
            title={
              shadowingActive
                ? 'Shadowing on: pauses after each line (Enter = next line, Control = repeat line)'
                : 'Shadowing mode'
            }
          >
            <Ear className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        )}

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

        {showFocusToggle && onToggleFocusMode && (
          <button
            type="button"
            onClick={onToggleFocusMode}
            className={`${toolBtn} ${focusMode ? 'bg-gray-800 text-white' : ''}`}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            title={focusMode ? 'Exit focus mode' : 'Focus mode'}
          >
            {focusMode ? (
              <Minimize2 className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
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
