'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Repeat,
  Maximize2,
  Minimize2,
  AudioLines,
  Mic,
  SlidersHorizontal,
} from 'lucide-react';
import { RepeatCount, type AppMode } from '@/types';
import { useLessonOptions } from '@/components/LessonOptions';
import { MorePopover, RepeatPopover } from '@/components/PlayerPopovers';
import { isRepeatCountActive, repeatCountAriaLabel, repeatCountTitle } from '@/lib/repeat-count';
import { formatTime } from '@/lib/utils';
import { usePlaybackTime, type PlaybackClock } from '@/lib/playbackClock';
import type { PlayerViButton } from '@/hooks/useSentenceTranslations';

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
  /** Translates the sentence just heard. Hidden in focus mode. */
  vi?: PlayerViButton;
  /** Opens the speaking check (Shadowing mode). */
  onSpeakingCheck?: () => void;
  /** Adds the lesson options (word meanings, pauses) for this mode to the More menu. */
  optionsMode?: AppMode;
}

const toolBtn =
  'flex h-10 w-10 @max-xs:w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white active:bg-gray-700';

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
  vi,
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
          {vi && (
            <button
              type="button"
              data-translate
              onClick={vi.onClick}
              disabled={vi.disabled}
              className={`${toolBtn} text-xs font-semibold disabled:pointer-events-none disabled:opacity-40 ${
                vi.active ? 'bg-gray-800 text-white' : ''
              }`}
              aria-label={vi.active ? 'Hide Vietnamese (T)' : 'Vietnamese (T)'}
              aria-pressed={vi.active}
              title="Vietnamese (T)"
            >
              <span className={vi.loading ? 'animate-pulse' : undefined}>VI</span>
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
