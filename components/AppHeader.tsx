'use client';

import React, { type RefObject } from 'react';
import { PanelLeft, Trash2, Headphones, PenTool, Mic, MoreVertical, Edit2 } from 'lucide-react';
import type { AppMode, LessonItem, DeckItem, Sentence } from '@/types';

export type HeaderSelectedItem = {
  id: string;
  type: 'lesson' | 'deck';
  data: LessonItem | DeckItem;
};

export interface AppHeaderProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  selectedItem: HeaderSelectedItem | null;
  onMobileBack: () => void;
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void | Promise<void>;
  isGeneratingIPA: boolean;
  transcript: Sentence[];
  shadowingGenerateIpa: boolean;
  setShadowingGenerateIpa: (v: boolean) => void;
  fetchIPA: () => void | Promise<void>;
  headerItemMenuOpen: boolean;
  setHeaderItemMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  headerMenuRefMobile: RefObject<HTMLDivElement | null>;
  headerMenuRefDesktop: RefObject<HTMLDivElement | null>;
  onRenameCurrent: () => void;
  onTrashCurrent: () => void;
}

export function AppHeader({
  isSidebarOpen,
  onOpenSidebar,
  selectedItem,
  onMobileBack,
  appMode,
  onModeChange,
  isGeneratingIPA,
  transcript,
  shadowingGenerateIpa,
  setShadowingGenerateIpa,
  fetchIPA,
  headerItemMenuOpen,
  setHeaderItemMenuOpen,
  headerMenuRefMobile,
  headerMenuRefDesktop,
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
            className="hidden md:block p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Open Sidebar"
          >
            <PanelLeft size={24} />
          </button>
        )}
        {selectedItem?.id && (
          <button
            type="button"
            onClick={onMobileBack}
            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Back to List"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <h1 className="app-logo">
          <Headphones size={24} aria-hidden />
          <span>Noda.</span>
        </h1>
        {selectedItem && (
          <div ref={headerMenuRefMobile} className="relative ml-auto shrink-0 md:hidden z-20">
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
          </div>
        )}
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
          {appMode === 'shadowing' && (
            <div className="shadowing-ipa-panel w-full max-w-xl mx-auto px-2 sm:px-3 pb-2 pt-2 border-t border-gray-800/80 transition-opacity duration-200">
              {isGeneratingIPA && (
                <div
                  className="flex items-center gap-2 text-xs text-emerald-400/95 mb-2 px-1"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"
                    aria-hidden
                  />
                  Generating pronunciation…
                </div>
              )}
              <label
                className={`flex items-start gap-3 rounded-lg p-2 -mx-1 transition-colors ${
                  transcript.length === 0 || isGeneratingIPA
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-gray-900/40'
                }`}
              >
                <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={shadowingGenerateIpa}
                    disabled={transcript.length === 0 || isGeneratingIPA}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setShadowingGenerateIpa(on);
                      if (on) void fetchIPA();
                    }}
                    aria-describedby="shadowing-ipa-hint"
                  />
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded border border-gray-600 bg-gray-900 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50 peer-checked:border-emerald-500 peer-checked:bg-emerald-600 peer-disabled:opacity-50"
                    aria-hidden
                  >
                    {shadowingGenerateIpa && (
                      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 10" fill="none" aria-hidden>
                        <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-200">Auto-generate IPA using AI</span>
                  <span id="shadowing-ipa-hint" className="mt-1 block text-xs text-gray-500 leading-relaxed">
                    {transcript.length === 0
                      ? 'Add a transcript (.srt) to the lesson to generate pronunciation hints.'
                      : 'Uses AI to add IPA under each line while you practice shadowing.'}
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      <div
        ref={headerMenuRefDesktop}
        className={`relative z-20 flex items-center justify-end shrink-0 ${
          selectedItem ? 'hidden md:flex w-auto min-w-[44px]' : 'hidden md:flex md:w-[150px]'
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
