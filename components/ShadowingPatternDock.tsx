'use client';

import React from 'react';
import { ShadowingPatternPanel } from './ShadowingPatternPanel';
import type { ShadowingEntry } from '@/hooks/useShadowingPatternManager';

interface ShadowingPatternDockProps {
  isMobile: boolean;
  entry: ShadowingEntry;
  sentenceText: string;
  onClose: () => void;
  onAnalyze: () => void;
}

/**
 * Presentational shell around `<ShadowingPatternPanel>`. The outer positioned/animated
 * container is owned by `LessonView.tsx` (a split column on desktop, an in-flow dock above
 * the player on mobile) - this just normalizes the padding for either host. On mobile the
 * host has only a max-height, so this is a shrinking flex column instead of `h-full`. The panel itself keeps the
 * annotated line pinned and scrolls only its notes, so this stays `overflow-hidden`.
 */
export function ShadowingPatternDock({ isMobile, entry, sentenceText, onClose, onAnalyze }: ShadowingPatternDockProps) {
  return (
    <div className={`overflow-hidden ${isMobile ? 'flex min-h-0 flex-col p-2.5' : 'h-full rounded-xl border border-gray-800 bg-gray-900 p-2.5'}`}>
      <ShadowingPatternPanel
        status={entry.status}
        analysis={entry.analysis}
        error={entry.error}
        sentenceText={sentenceText}
        onAnalyze={onAnalyze}
        onClose={onClose}
      />
    </div>
  );
}
