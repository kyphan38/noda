'use client';

import React, { useState } from 'react';
import { Music2, Layers, LogOut, PanelLeft } from 'lucide-react';
import { LessonSummary, ExpandedSections, LessonItem, DeckItem, TrashItem } from '@/types';
import { SidebarSection } from './SidebarSection';

interface SidebarProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  lessons: LessonSummary[];
  selectedItemId?: string;
  expandedSections: ExpandedSections;
  onItemSelect: (item: LessonItem | DeckItem) => void;
  onNewLesson: () => void;
  onNewDeck: () => void;
  onTrashLesson: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onLogout: () => void;
  onToggleSection: (section: string, expanded: boolean) => void;
}

export function Sidebar({
  isOpen,
  onToggle,
  lessons,
  selectedItemId,
  expandedSections,
  onItemSelect,
  onNewLesson,
  onNewDeck,
  onTrashLesson,
  onRenameLesson,
  onLogout,
  onToggleSection,
}: SidebarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Map LessonSummary to the new types based on hasAudio
  const activeLessons: LessonItem[] = lessons
    .filter((l) => !l.isTrashed && l.hasAudio)
    .map((l) => ({
      id: l.id,
      name: l.name,
      language: l.language as 'en' | 'de',
      progress: l.progress,
      hasAudio: l.hasAudio,
      hasIpa: l.hasIpa,
      type: 'lesson',
    }));

  const activeDecks: DeckItem[] = lessons
    .filter((l) => !l.isTrashed && !l.hasAudio)
    .map((l) => ({
      id: l.id,
      name: l.name,
      language: l.language as 'en' | 'de' | 'mixed',
      cardCount: l.progress, // Using progress as a proxy for card count since it's the only number available
      type: 'deck',
    }));

  const trashItems: TrashItem[] = lessons
    .filter((l) => l.isTrashed)
    .map((l) => ({
      id: l.id,
      name: l.name,
      originalType: l.hasAudio ? 'lesson' : 'deck',
      language: l.language,
    }));

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => onToggle(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`shrink-0 transition-all duration-300 ease-in-out ${isOpen ? 'w-72' : 'w-0'} relative z-50`}
      >
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Noda.
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onLogout}
                className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
              <button
                onClick={() => onToggle(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Close Sidebar"
              >
                <PanelLeft size={20} />
              </button>
            </div>
          </div>

          <div className="actions-container flex flex-col gap-2 p-4">
            <button
              onClick={onNewLesson}
              className="btn-new-lesson w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Music2 size={18} /> + New Lesson
            </button>
            <button
              onClick={onNewDeck}
              className="btn-new-deck w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Layers size={18} /> + New Deck
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-6">
            {/* Audio Lessons Section */}
            <SidebarSection
              type="lessons"
              title="LESSONS"
              items={activeLessons}
              selectedItemId={selectedItemId}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onItemSelect={onItemSelect}
              onTrashLesson={onTrashLesson}
              onRenameLesson={onRenameLesson}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
            />

            {/* Flashcards Section */}
            <SidebarSection
              type="decks"
              title="DECKS"
              items={activeDecks}
              selectedItemId={selectedItemId}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onItemSelect={onItemSelect}
              onTrashLesson={onTrashLesson}
              onRenameLesson={onRenameLesson}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              emptyMessage="No flashcard decks yet."
            />

            {/* Trash Section */}
            <SidebarSection
              type="trash"
              title="TRASH & CACHE"
              items={trashItems}
              selectedItemId={selectedItemId}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onItemSelect={onItemSelect}
              onTrashLesson={onTrashLesson}
              onRenameLesson={onRenameLesson}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
            />
          </div>
        </div>
      </div>
    </>
  );
}
