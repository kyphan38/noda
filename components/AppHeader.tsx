'use client';

import React, { type RefObject } from 'react';
import { PanelLeft, Trash2, Headphones, PenTool, Mic, MoreVertical, Edit2 } from 'lucide-react';
import type { AppMode, LessonItem, DeckItem } from '@/types';

export type HeaderSelectedItem = {
  id: string;
  type: 'lesson' | 'deck';
  data: LessonItem | DeckItem;
};

export interface AppHeaderProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  selectedItem: HeaderSelectedItem | null;
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void | Promise<void>;
  headerItemMenuOpen: boolean;
  setHeaderItemMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  headerMenuRef: RefObject<HTMLDivElement | null>;
  onRenameCurrent: () => void;
  onTrashCurrent: () => void;
}

export function AppHeader({
  isSidebarOpen,
  onOpenSidebar,
  selectedItem,
  appMode,
  onModeChange,
  headerItemMenuOpen,
  setHeaderItemMenuOpen,
  headerMenuRef,
  onRenameCurrent,
  onTrashCurrent,
}: AppHeaderProps) {
  return (
    <header className="app-header">
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
        <h1 className="app-logo">
          <Headphones size={24} aria-hidden />
          <span>Noda.</span>
        </h1>
      </div>

      {selectedItem?.type === 'lesson' && (
        <div className="mode-tabs-container">
          <div className="mode-tabs" role="tablist" aria-label="Lesson mode">
            <button
              type="button"
              role="tab"
              aria-selected={appMode === 'normal'}
              data-mode="listen"
              className={`mode-tab ${appMode === 'normal' ? 'active' : ''}`}
              title="Normal mode (⌘1 / Ctrl+1)"
              onClick={() => void onModeChange('normal')}
            >
              <Headphones size={18} aria-hidden />
              <span className="mode-tab-label">Normal</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={appMode === 'dictation'}
              data-mode="dictation"
              className={`mode-tab ${appMode === 'dictation' ? 'active' : ''}`}
              title="Dictation mode (⌘2 / Ctrl+2)"
              onClick={() => void onModeChange('dictation')}
            >
              <PenTool size={18} aria-hidden />
              <span className="mode-tab-label">Dictation</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={appMode === 'shadowing'}
              data-mode="shadowing"
              className={`mode-tab ${appMode === 'shadowing' ? 'active' : ''}`}
              title="Shadowing mode (⌘3 / Ctrl+3)"
              onClick={() => void onModeChange('shadowing')}
            >
              <Mic size={18} aria-hidden />
              <span className="mode-tab-label">Shadowing</span>
            </button>
          </div>
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
              aria-label="Lesson or deck actions"
            >
              <MoreVertical size={22} aria-hidden />
            </button>
            {headerItemMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-30">
                <button
                  type="button"
                  onClick={onRenameCurrent}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                >
                  <Edit2 size={14} aria-hidden /> Rename
                </button>
                <button
                  type="button"
                  onClick={onTrashCurrent}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
                >
                  <Trash2 size={14} aria-hidden /> Move to Trash
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </header>
  );
}
