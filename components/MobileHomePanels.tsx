'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { SidebarSection } from '@/components/SidebarSection';
import type { AppTab, DeckItem, LessonItem, LessonSummary } from '@/types';

export interface MobileHomePanelsProps {
  activeTab: AppTab;
  selectedItemId: string | undefined;
  lessonsList: LessonSummary[];
  isListLoading: boolean;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string, expanded: boolean) => void;
  onItemSelect: (item: LessonItem | DeckItem) => void;
  onTrashLessonFromList: (id: string) => void;
  onRenameLesson: (id: string, newName: string) => void;
  mobileSidebarMenuId: string | null;
  setMobileSidebarMenuId: (id: string | null) => void;
  onOpenNewLesson: () => void;
  onOpenNewDeck: () => void;
}

export function MobileHomePanels({
  activeTab,
  selectedItemId,
  lessonsList,
  isListLoading,
  expandedSections,
  onToggleSection,
  onItemSelect,
  onTrashLessonFromList,
  onRenameLesson,
  mobileSidebarMenuId,
  setMobileSidebarMenuId,
  onOpenNewLesson,
  onOpenNewDeck,
}: MobileHomePanelsProps) {
  return (
    <div className="md:hidden flex-1 overflow-y-auto">
      {activeTab === 'Lessons' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={onOpenNewLesson}
            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 font-medium transition-colors mb-4"
          >
            <Plus size={20} /> New Activity
          </button>
          <SidebarSection
            type="lessons"
            title="LESSONS"
            items={lessonsList
              .filter((l) => !l.isTrashed && l.kind === 'audio')
              .map((l) => ({
                id: l.id,
                name: l.name,
                language: l.language as 'en' | 'de',
                progress: l.progress,
                hasAudio: l.hasAudio,
                hasIpa: l.hasIpa,
                type: 'lesson' as const,
              }))}
            isLoading={isListLoading}
            selectedItemId={selectedItemId}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onItemSelect={onItemSelect}
            onTrashLesson={onTrashLessonFromList}
            onRenameLesson={onRenameLesson}
            activeMenu={mobileSidebarMenuId}
            setActiveMenu={setMobileSidebarMenuId}
          />
        </div>
      )}

      {activeTab === 'Flashcards' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={onOpenNewDeck}
            className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl border border-blue-500/30 flex items-center justify-center gap-2 font-medium transition-colors mb-4"
          >
            <Plus size={20} /> New Deck
          </button>
          <SidebarSection
            type="decks"
            title="DECKS"
            items={lessonsList
              .filter((l) => !l.isTrashed && l.kind === 'flashcard')
              .map((l) => ({
                id: l.id,
                name: l.name,
                language: l.language as 'en' | 'de' | 'mixed',
                cardCount: l.totalSentences,
                type: 'deck' as const,
              }))}
            isLoading={isListLoading}
            selectedItemId={selectedItemId}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onItemSelect={onItemSelect}
            onTrashLesson={onTrashLessonFromList}
            onRenameLesson={onRenameLesson}
            activeMenu={mobileSidebarMenuId}
            setActiveMenu={setMobileSidebarMenuId}
          />
        </div>
      )}

      {activeTab === 'Stats' && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
          <div className="text-6xl">📊</div>
          <h2 className="text-xl font-bold text-white">Stats</h2>
          <p>Your learning statistics will appear here.</p>
        </div>
      )}
    </div>
  );
}
