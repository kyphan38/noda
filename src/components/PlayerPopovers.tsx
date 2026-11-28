'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Video, VideoOff, Eye, EyeOff, Infinity } from 'lucide-react';
import { RepeatCount, type AppMode } from '@/types';
import { LessonOptionRows } from '@/components/LessonOptions';
import { REPEAT_COUNT_OPTIONS, repeatOptionAriaLabel } from '@/lib/repeat-count';
import { MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE } from '@/constants';

/** The player's More menu and repeat picker, opened above their buttons. */
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
export function MorePopover({
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

export function RepeatPopover({
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
