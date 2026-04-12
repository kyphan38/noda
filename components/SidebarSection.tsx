import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LessonItem, DeckItem } from '@/types';
import { LessonCard } from './LessonCard';
import { DeckCard } from './DeckCard';
import { LessonCardSkeleton, DeckCardSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface SidebarSectionProps {
  type: 'lessons' | 'decks';
  title: string;
  items: LessonItem[] | DeckItem[];
  selectedItemId?: string;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string, expanded: boolean) => void;
  onItemSelect: (item: LessonItem | DeckItem) => void;
  onDeleteLesson: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function SidebarSection({
  type,
  title,
  items,
  selectedItemId,
  expandedSections,
  onToggleSection,
  onItemSelect,
  onDeleteLesson,
  onRenameLesson,
  onChangeLanguage,
  activeMenu,
  setActiveMenu,
  emptyMessage,
  isLoading,
}: SidebarSectionProps) {
  const isExpanded = expandedSections[type] ?? (type === 'lessons' || type === 'decks');
  const toggleSection = () => onToggleSection(type, !isExpanded);

  return (
    <div className="space-y-1">
      <button
        onClick={toggleSection}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors duration-200"
      >
        <span>{title}</span>
        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {isLoading && type === 'lessons' && (
            <div className="space-y-2 px-1">
              <LessonCardSkeleton />
              <LessonCardSkeleton />
              <LessonCardSkeleton />
            </div>
          )}

          {isLoading && type === 'decks' && (
            <div className="space-y-1 px-1">
              <DeckCardSkeleton />
              <DeckCardSkeleton />
              <DeckCardSkeleton />
            </div>
          )}

          {!isLoading && items.length === 0 && (type === 'lessons' || type === 'decks') && (
            <EmptyState type={type} />
          )}

          {!isLoading && type === 'lessons' && items.length > 0 && (() => {
            const list = items as LessonItem[];
            const enLessons = list.filter((i) => i.language === 'en');
            const deLessons = list.filter((i) => i.language === 'de');
            return (
              <>
                {enLessons.length > 0 && (
                  <Accordion
                    title="EN"
                    isExpanded={expandedSections['audio-en'] ?? true}
                    onToggle={() => onToggleSection('audio-en', !(expandedSections['audio-en'] ?? true))}
                  >
                    {enLessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        selectedItemId={selectedItemId}
                        onItemSelect={onItemSelect}
                        onDeleteLesson={onDeleteLesson}
                        onRenameLesson={onRenameLesson}
                        onChangeLanguage={onChangeLanguage}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                      />
                    ))}
                  </Accordion>
                )}
                {deLessons.length > 0 && (
                  <Accordion
                    title="DE"
                    isExpanded={expandedSections['audio-de'] ?? false}
                    onToggle={() => onToggleSection('audio-de', !(expandedSections['audio-de'] ?? false))}
                  >
                    {deLessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        selectedItemId={selectedItemId}
                        onItemSelect={onItemSelect}
                        onDeleteLesson={onDeleteLesson}
                        onRenameLesson={onRenameLesson}
                        onChangeLanguage={onChangeLanguage}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                      />
                    ))}
                  </Accordion>
                )}
              </>
            );
          })()}

          {!isLoading && type === 'decks' && items.length > 0 && (() => {
            const list = items as DeckItem[];
            const enDecks = list.filter((d) => d.language === 'en' || d.language === 'mixed');
            const deDecks = list.filter((d) => d.language === 'de');
            return (
              <>
                {enDecks.length > 0 && (
                  <Accordion
                    title="EN"
                    isExpanded={expandedSections['flashcard-en'] ?? true}
                    onToggle={() => onToggleSection('flashcard-en', !(expandedSections['flashcard-en'] ?? true))}
                  >
                    {enDecks.map((deck) => (
                      <DeckCard
                        key={deck.id}
                        deck={deck}
                        selectedItemId={selectedItemId}
                        onItemSelect={onItemSelect}
                        onDeleteLesson={onDeleteLesson}
                        onRenameLesson={onRenameLesson}
                        onChangeLanguage={onChangeLanguage}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                      />
                    ))}
                  </Accordion>
                )}
                {deDecks.length > 0 && (
                  <Accordion
                    title="DE"
                    isExpanded={expandedSections['flashcard-de'] ?? false}
                    onToggle={() =>
                      onToggleSection('flashcard-de', !(expandedSections['flashcard-de'] ?? false))
                    }
                  >
                    {deDecks.map((deck) => (
                      <DeckCard
                        key={deck.id}
                        deck={deck}
                        selectedItemId={selectedItemId}
                        onItemSelect={onItemSelect}
                        onDeleteLesson={onDeleteLesson}
                        onRenameLesson={onRenameLesson}
                        onChangeLanguage={onChangeLanguage}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                      />
                    ))}
                  </Accordion>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Accordion({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-200 transition-colors duration-200"
      >
        <span>{title}</span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isExpanded && <div className="space-y-1">{children}</div>}
    </div>
  );
}
