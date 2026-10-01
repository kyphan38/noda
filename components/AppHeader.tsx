'use client';

import React, { type RefObject } from 'react';
import { PanelLeft, Trash2, MoreVertical, Edit2 } from 'lucide-react';
import type { AppMode, LessonItem } from '@/types';
import { cn } from '@/lib/utils';
import { LESSON_MODES } from '@/constants';

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
  onDeleteCurrent,
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
      </div>

      {selectedItem && (
        <div className="mode-tabs-container">
          <nav className="mode-tabs" aria-label="Lesson mode">
            {LESSON_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                className={cn('mode-tab', appMode === mode && 'active')}
                aria-current={appMode === mode ? 'page' : undefined}
                onClick={() => void onModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </nav>
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
                  onClick={onDeleteCurrent}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
                >
                  <Trash2 size={14} aria-hidden /> Delete
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </header>
  );
}
