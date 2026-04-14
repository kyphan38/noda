'use client';

import React, { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { PanelLeft, Trash2, MoreVertical, Edit2, ChevronDown } from 'lucide-react';
import type { AppMode, LessonItem, DeckItem } from '@/types';

export type HeaderSelectedItem = {
  id: string;
  type: 'lesson' | 'deck';
  data: LessonItem | DeckItem;
};

export interface AppHeaderProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  /** When true, hide Normal/Dictation/Shadowing tabs (mobile decks-only UX). */
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
  isMobile = false,
  selectedItem,
  appMode,
  onModeChange,
  headerItemMenuOpen,
  setHeaderItemMenuOpen,
  headerMenuRef,
  onRenameCurrent,
  onDeleteCurrent,
}: AppHeaderProps) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (modeMenuRef.current?.contains(t)) return;
      setModeMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [modeMenuOpen]);

  const modeLabel = useMemo(() => {
    if (appMode === 'dictation') return 'Dictation';
    if (appMode === 'shadowing') return 'Shadowing';
    return 'Normal';
  }, [appMode]);

  const modeChoices = useMemo(
    () =>
      (['normal', 'dictation', 'shadowing'] as AppMode[]).filter(
        (mode) => mode !== appMode
      ),
    [appMode]
  );

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

      {selectedItem?.type === 'lesson' && !isMobile && (
        <div className="mode-tabs-container">
          <div ref={modeMenuRef} className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800 transition-colors"
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              onClick={() => setModeMenuOpen((v) => !v)}
            >
              <span>{modeLabel}</span>
              <ChevronDown size={16} className={modeMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {modeMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl z-30"
              >
                {modeChoices.map((mode) => {
                  const label =
                    mode === 'dictation'
                      ? 'Dictation'
                      : mode === 'shadowing'
                        ? 'Shadowing'
                        : 'Normal';
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setModeMenuOpen(false);
                        void onModeChange(mode);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
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
