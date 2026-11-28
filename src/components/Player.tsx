'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Repeat,
  Video,
  VideoOff,
  Eye,
  EyeOff,
  Infinity,
  Maximize2,
  Minimize2,
  AudioLines,
  Mic,
  SlidersHorizontal,
} from 'lucide-react';
import { RepeatCount, type AppMode } from '@/types';
import { LessonOptionRows, useLessonOptions } from '@/components/LessonOptions';
import {
  REPEAT_COUNT_OPTIONS,
  isRepeatCountActive,
  repeatCountAriaLabel,
  repeatCountTitle,
  repeatOptionAriaLabel,
} from '@/lib/repeat-count';
import { formatTime } from '@/lib/utils';
import { MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE } from '@/constants';
import { usePlaybackTime, type PlaybackClock } from '@/lib/playbackClock';

/** Opens/closes the shadowing pattern panel, which follows the sentence being played. */
export interface PlayerAiButton {
  onClick: () => void;
  /** The panel is open. */
  active: boolean;
  loading: boolean;
  /** An analysis for the current sentence is already cached - opening it is free. */
  cached: boolean;
  disabled: boolean;
}

interface PlayerProps {
  isPlaying: boolean;
  duration: number;
  /** Frame-accurate playback time; the player re-renders on its own as it moves. */
  clock: PlaybackClock;
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
  /** Shown only where the analysis is available (not in Dictation, not with captions hidden). */
  ai?: PlayerAiButton;
  /** Opens the speaking check (Shadowing mode). */
  onSpeakingCheck?: () => void;
  /** Adds the lesson options (word meanings, pauses) for this mode to the More menu. */
  optionsMode?: AppMode;
}

const toolBtn =
  'flex h-10 w-10 @max-xs:w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white active:bg-gray-700';

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

/**
 * Settings that are set once and left alone (speed, video, captions, words, pauses), kept out of
 * the bar so the controls used every few seconds stay one tap away.
 */
function MorePopover({
  speed,
  onSpeedChange,
  showVideoToggle,
  videoHidden,
  onToggleVideoHidden,
  showCaptionsToggle,
  captionsHidden,
  onToggleCaptions,
  onClose,
  triggerRef,
  optionsMode,
}: {
  speed: number;
  onSpeedChange: (s: number) => void;
  showVideoToggle: boolean;
  videoHidden: boolean;
  onToggleVideoHidden?: () => void;
  showCaptionsToggle: boolean;
  captionsHidden: boolean;
  onToggleCaptions?: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  optionsMode?: AppMode;
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, triggerRef]);

  if (!pos) return null;

  const row =
    'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white';
  const icon = 'h-4 w-4 shrink-0';

  return createPortal(
    <div
      ref={popoverRef}
      data-more-menu
      style={{
        position: 'fixed',
        top: pos.top,
        // The button sits at the right end of the bar: keep the 12rem menu on screen.
        left: Math.max(104, Math.min(pos.left, window.innerWidth - 104)),
        transform: 'translate(-50%, -100%)',
      }}
      className="z-[9999] flex w-48 flex-col gap-1 rounded-xl border border-gray-700 bg-gray-900 p-1.5"
    >
      <div className="flex flex-col gap-1.5 px-2 pb-1.5 pt-1">
        <span className="text-xs font-medium tabular-nums text-white">{speed.toFixed(1)}× speed</span>
        <input
          type="range"
          min={MIN_PLAYBACK_RATE}
          max={MAX_PLAYBACK_RATE}
          step={0.1}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-gray-300"
          aria-label="Playback speed"
        />
      </div>
      {((showVideoToggle && onToggleVideoHidden) || (showCaptionsToggle && onToggleCaptions)) && (
        <div className="border-t border-gray-800 pt-1">
          {showVideoToggle && onToggleVideoHidden && (
            <button type="button" onClick={onToggleVideoHidden} className={row}>
              {videoHidden ? <Video className={icon} aria-hidden /> : <VideoOff className={icon} aria-hidden />}
              {videoHidden ? 'Show video' : 'Hide video'}
            </button>
          )}
          {showCaptionsToggle && onToggleCaptions && (
            <button type="button" onClick={onToggleCaptions} className={row}>
              {captionsHidden ? <Eye className={icon} aria-hidden /> : <EyeOff className={icon} aria-hidden />}
              <span className="flex-1">{captionsHidden ? 'Show captions' : 'Hide captions'}</span>
              <kbd className="font-mono text-[10px] text-gray-500">H</kbd>
            </button>
          )}
        </div>
      )}
      {optionsMode && <LessonOptionRows mode={optionsMode} />}
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
      className="z-[9999] flex items-center gap-1 rounded-xl border border-gray-700 bg-gray-900 px-2 py-2"
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
              ? 'bg-gray-100 text-gray-900'
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
  clock,
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
  ai,
  onSpeakingCheck,
  optionsMode,
}: PlayerProps) {
  const currentTime = usePlaybackTime(clock);

  // The play/pause icon pops when the state changes, not when the player first appears.
  const [prevPlaying, setPrevPlaying] = useState(isPlaying);
  const [toggled, setToggled] = useState(false);
  if (isPlaying !== prevPlaying) {
    setPrevPlaying(isPlaying);
    setToggled(true);
  }
  const [showMore, setShowMore] = useState(false);
  const [showRepeatPopover, setShowRepeatPopover] = useState(false);

  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const repeatBtnRef = useRef<HTMLButtonElement>(null);

  const closeMore = useCallback(() => setShowMore(false), []);
  const options = useLessonOptions(optionsMode ?? 'dictation');
  const moreChanged =
    Math.abs(playbackRate - 1) > 0.001 ||
    (showVideoToggle && videoHidden) ||
    (showCaptionsToggle && captionsHidden) ||
    (!!optionsMode && options.changed);
  const closeRepeat = useCallback(() => setShowRepeatPopover(false), []);

  return (
    // Container query: two rows (seek bar above the buttons) whenever the bar itself is
    // narrower than 32rem, so it fits any phone width without per-device rules.
    <div className="@container shrink-0">
      <div
        className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl border border-gray-800 bg-gray-900 px-2.5 py-2 font-sans @lg:h-14 @lg:flex-nowrap @lg:py-0 sm:gap-3 sm:px-3 sm:@lg:h-12"
        role="group"
        aria-label="Playback controls"
      >
        <button
          type="button"
          onClick={onPlayPause}
          className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-colors hover:bg-white active:scale-95 active:bg-gray-300"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {/* A key per icon, so the new one mounts and pops once. Not on first render. */}
          {isPlaying ? (
            <Pause key="pause" className={`h-4 w-4 fill-current${toggled ? ' pop' : ''}`} aria-hidden />
          ) : (
            <Play key="play" className={`ml-0.5 h-4 w-4 fill-current${toggled ? ' pop' : ''}`} aria-hidden />
          )}
        </button>

        <div className="order-first flex w-full min-w-0 flex-none items-center gap-1.5 @lg:order-none @lg:w-auto @lg:flex-1 sm:gap-2">
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
            className={`h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-gray-300 sm:h-2 ${
              seekDisabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''
            }`}
          />
          <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-gray-400 sm:w-10 sm:text-sm">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-0.5 @lg:flex-none @lg:justify-start">
          {ai && (
            <button
              type="button"
              data-shadowing-ai
              onClick={ai.onClick}
              disabled={ai.disabled}
              className={`${toolBtn} relative disabled:pointer-events-none disabled:opacity-40 ${
                ai.active ? 'bg-gray-800 text-white' : ''
              }`}
              aria-label={ai.active ? 'Hide shadowing pattern (A)' : 'Show shadowing pattern (A)'}
              aria-pressed={ai.active}
              title={ai.cached ? 'Shadowing pattern - this sentence is analyzed (A)' : 'Shadowing pattern (A)'}
            >
              {ai.loading ? (
                <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-current" aria-hidden />
              ) : (
                <AudioLines className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {ai.cached && !ai.loading && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gray-100" aria-hidden />
              )}
            </button>
          )}
          {onSpeakingCheck && (
            <button
              type="button"
              data-speaking-check
              onClick={onSpeakingCheck}
              className={toolBtn}
              aria-label="Speaking check"
              title="Speaking check"
            >
              <Mic className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          )}
          <button
            ref={repeatBtnRef}
            type="button"
            data-repeat-trigger
            onClick={() => {
              setShowRepeatPopover((v) => !v);
              setShowMore(false);
            }}
            className={`${toolBtn} ${
              isRepeatCountActive(repeatCount)
                ? 'text-white bg-gray-700/60 hover:bg-gray-700'
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

          <button
            ref={moreBtnRef}
            type="button"
            data-more-trigger
            onClick={() => {
              setShowMore((v) => !v);
              setShowRepeatPopover(false);
            }}
            className={`${toolBtn} relative ${showMore ? 'bg-gray-800 text-white' : ''}`}
            aria-label="More: speed, video, captions, words, music"
            aria-expanded={showMore}
            title={`More (speed ${playbackRate.toFixed(1)}×)`}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            {/* A setting away from its default shows here, so nothing hides behind the menu unseen. */}
            {moreChanged && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gray-100" aria-hidden />
            )}
          </button>
          {showMore && (
            <MorePopover
              speed={playbackRate}
              onSpeedChange={onSpeedChange}
              showVideoToggle={showVideoToggle}
              videoHidden={videoHidden}
              onToggleVideoHidden={onToggleVideoHidden}
              showCaptionsToggle={showCaptionsToggle}
              captionsHidden={captionsHidden}
              onToggleCaptions={onToggleCaptions}
              onClose={closeMore}
              triggerRef={moreBtnRef}
              optionsMode={optionsMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
