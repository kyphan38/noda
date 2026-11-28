'use client';

import React from 'react';
import { ShadowingPatternDock } from './ShadowingPatternDock';
import type { ShadowingEntry } from '@/hooks/useShadowingPatternManager';
import { cn } from '@/lib/utils';

interface ShadowingDockAreaProps {
  isMobile: boolean;
  isOpen: boolean;
  sentenceId: number | null;
  entry: ShadowingEntry | undefined;
  sentenceText: string;
  onClose: () => void;
  onAnalyze: () => void;
  autoAnalyze: boolean;
  autoStopped: boolean;
  onAutoAnalyzeChange: (on: boolean) => void;
}

/**
 * The animated host of the shadowing-pattern panel next to the transcript.
 * Mobile: an in-flow dock between the transcript and the player, not a modal sheet, so the
 * learner can loop the line and read the analysis at the same time. Desktop: a side column.
 */
export function ShadowingDockArea({ isMobile, isOpen, sentenceId, entry, ...dock }: ShadowingDockAreaProps) {
  const content =
    isOpen && sentenceId != null && entry ? (
      <ShadowingPatternDock key={sentenceId} isMobile={isMobile} entry={entry} {...dock} />
    ) : null;

  if (isMobile) {
    return (
      <div
        className={cn(
          'shrink-0 flex flex-col overflow-hidden rounded-xl bg-gray-900 transition-[max-height] duration-300 ease-in-out',
          isOpen ? 'max-h-[45dvh] border border-gray-800' : 'max-h-0'
        )}
      >
        {content}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
        isOpen ? 'w-[30%] max-w-[320px] min-w-[240px]' : 'w-0'
      )}
    >
      {content}
    </div>
  );
}
