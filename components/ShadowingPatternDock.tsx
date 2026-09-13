'use client';

import React from 'react';
import { ShadowingPatternPanel } from './ShadowingPatternPanel';
import type { ShadowingEntry } from '@/hooks/useShadowingPatternManager';

interface ShadowingPatternDockProps {
  isMobile: boolean;
  entry: ShadowingEntry;
  onClose: () => void;
  onRetry: () => void;
}

/**
 * Presentational shell around `<ShadowingPatternPanel>`. The outer positioned/animated
 * container is owned by `LessonView.tsx` (a split column on desktop, a fixed bottom sheet
 * on mobile) - this just normalizes the padding for either host. The panel itself keeps the
 * annotated line pinned and scrolls only its notes, so this stays `overflow-hidden`.
 */
export function ShadowingPatternDock({ isMobile, entry, onClose, onRetry }: ShadowingPatternDockProps) {
  return (
    <div className={`h-full overflow-hidden ${isMobile ? 'p-2.5' : 'border-l border-gray-800 bg-gray-900 p-2.5'}`}>
      <ShadowingPatternPanel
        status={entry.status}
        analysis={entry.analysis}
        error={entry.error}
        onRetry={onRetry}
        onClose={onClose}
      />
    </div>
  );
}
