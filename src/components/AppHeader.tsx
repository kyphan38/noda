'use client';

import React, { useState, type RefObject } from 'react';
import { PanelLeft, Trash2, MoreVertical, Edit2, RotateCcw, MessageSquareQuote } from 'lucide-react';
import type { AppMode, LessonItem, Sentence } from '@/types';
import { LessonTalkModal } from '@/components/LessonTalkModal';
import { cn } from '@/lib/utils';
import { LESSON_MODES } from '@/constants';
import { useIndicator } from '@/hooks/useIndicator';

/** The mode tabs with one shared pill that slides to the active tab. */
function ModeTabs({
  appMode,
  onModeChange,
}: {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void | Promise<void>;
}) {
  const { container, indicator } = useIndicator<HTMLElement, HTMLSpanElement>(appMode);
  return (
    <nav ref={container} className="mode-tabs" aria-label="Lesson mode">
      <span ref={indicator} aria-hidden="true" className="mode-tab-pill" />
      {LESSON_MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={cn('mode-tab', appMode === mode && 'active')}
          data-active={appMode === mode}
          aria-current={appMode === mode ? 'page' : undefined}
          onClick={() => void onModeChange(mode)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export type HeaderSelectedItem = {
  id: string;
  type: 'lesson';
  data: LessonItem;
};

export interface AppHeaderProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  isMobile?: boolean;
  selectedItem: HeaderSelectedItem | null;
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void | Promise<void>;
  headerItemMenuOpen: boolean;
  setHeaderItemMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  headerMenuRef: RefObject<HTMLDivElement | null>;
  onRenameCurrent: () => void;
  onDeleteCurrent: () => void;
  /** Share of the lesson done in the current tab; null in listen. */
  modeProgress: number | null;
  /** Clears the current tab's progress; absent in listen. */
  onResetProgress?: () => void;
  /** The open lesson's sentences, for Retell. */
  transcript?: Sentence[];
}

export function AppHeader({
  isSidebarOpen,
  onOpenSidebar,
  isMobile = false,
  selectedItem,
  appMode,
  onModeChange,
  headerItemMenuOpen,
  setHeaderItemMenuOpen,
  headerMenuRef,
  onRenameCurrent,
  onDeleteCurrent,
  modeProgress,
  onResetProgress,
  transcript = [],
}: AppHeaderProps) {
  const [retellOpen, setRetellOpen] = useState(false);
  const modeLabel = LESSON_MODES.find((m) => m.mode === appMode)?.label ?? appMode;
  // On a phone the start page puts the sidebar button in its own title row.
  if (isMobile && !selectedItem) return null;
  return (
    // With no lesson open, the header only holds the sidebar button; on a computer it floats
    // so the start page title lines up with the other pages.
    <header className={cn('app-header', !selectedItem && 'app-header-floating')}>
      <div className="header-left">
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Open Sidebar"
          >
            <PanelLeft size={24} />
          </button>
        )}
      </div>

      {selectedItem && (
        <div className="mode-tabs-container">
          <ModeTabs appMode={appMode} onModeChange={onModeChange} />
          <p className="max-w-full truncate text-xs text-gray-500" title={selectedItem.data.name}>
            <span className="text-gray-300">{selectedItem.data.name}</span>
            {modeProgress !== null && (
              <span className="tabular-nums">
                {' '}
                · {modeProgress}%
              </span>
            )}
          </p>
        </div>
      )}

      <div
        ref={headerMenuRef}
        className={`relative z-20 flex items-center justify-end shrink-0 ${
          selectedItem ? 'w-auto min-w-[44px]' : 'md:w-[150px]'
        }`}
      >
        {selectedItem ? (
          <>
            <button
              type="button"
              onClick={() => setHeaderItemMenuOpen((o) => !o)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-expanded={headerItemMenuOpen}
              aria-label="Lesson actions"
            >
              <MoreVertical size={22} aria-hidden />
            </button>
            {headerItemMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg py-1 z-30">
                <button
                  type="button"
                  onClick={onRenameCurrent}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <Edit2 size={14} aria-hidden /> Rename
                </button>
                {transcript.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderItemMenuOpen(false);
                      setRetellOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                  >
                    <MessageSquareQuote size={14} aria-hidden /> Retell
                  </button>
                )}
                {onResetProgress && (
                  <button
                    type="button"
                    onClick={onResetProgress}
                    aria-label={`Reset ${appMode} progress`}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                  >
                    <RotateCcw size={14} aria-hidden /> Reset {modeLabel.toLowerCase()}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDeleteCurrent}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <Trash2 size={14} aria-hidden /> Delete
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
      {retellOpen && selectedItem && <LessonTalkModal transcript={transcript} onClose={() => setRetellOpen(false)} />}
    </header>
  );
}
