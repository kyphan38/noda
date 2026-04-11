import React from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { LessonSummary, LessonItem, DeckItem, TrashItem } from '@/types';
import { LessonCard } from './LessonCard';
import { DeckCard } from './DeckCard';
import { TrashCard } from './TrashCard';
import { LessonCardSkeleton, DeckCardSkeleton, TrashCardSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface SidebarSectionProps {
  type: 'lessons' | 'decks' | 'trash';
  title: string;
  items: any[]; // Using any[] to accept LessonItem[], DeckItem[], or TrashItem[]
  selectedItemId?: string;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string, expanded: boolean) => void;
  onItemSelect: (item: LessonItem | DeckItem) => void;
  onTrashLesson: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
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
  onTrashLesson,
  onRenameLesson,
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
        <span className="flex items-center gap-2">
          {type === 'trash' && <Trash2 size={15} />}
          {title}
        </span>
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

          {isLoading && type === 'trash' && (
            <div className="space-y-1 px-1">
              <TrashCardSkeleton />
              <TrashCardSkeleton />
            </div>
          )}

          {!isLoading && items.length === 0 && (type === 'lessons' || type === 'decks' || type === 'trash') && (
            <EmptyState type={type} />
          )}

          {!isLoading && type === 'lessons' && items.length > 0 && (() => {
            const enLessons = items.filter((i: LessonItem) => i.language === 'en');
            const deLessons = items.filter((i: LessonItem) => i.language === 'de');
            return (
              <>
                {enLessons.length > 0 && (
                  <Accordion
                    title="🇬🇧 English"
                    isExpanded={expandedSections['audio-en'] ?? true}
                    onToggle={() => onToggleSection('audio-en', !(expandedSections['audio-en'] ?? true))}
                  >
                    {enLessons.map((lesson: LessonItem) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        selectedItemId={selectedItemId}
                        onItemSelect={onItemSelect}
                        onTrashLesson={onTrashLesson}
                        onRenameLesson={onRenameLesson}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                      />
                    ))}
                  </Accordion>
                )}
                {deLessons.length > 0 && (
                  <Accordion
                    title="🇩🇪 German"
                    isExpanded={expandedSections['audio-de'] ?? false}
                    onToggle={() => onToggleSection('audio-de', !(expandedSections['audio-de'] ?? false))}
                  >
                    {deLessons.map((lesson: LessonItem) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        selectedItemId={selectedItemId}
                        onItemSelect={onItemSelect}
                        onTrashLesson={onTrashLesson}
                        onRenameLesson={onRenameLesson}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                      />
                    ))}
                  </Accordion>
                )}
              </>
            );
          })()}

          {!isLoading && type === 'decks' && items.length > 0 && (
            <div className="space-y-1">
              {items.map((deck: DeckItem) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  selectedItemId={selectedItemId}
                  onItemSelect={onItemSelect}
                  onTrashLesson={onTrashLesson}
                  onRenameLesson={onRenameLesson}
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                />
              ))}
            </div>
          )}

          {!isLoading && type === 'trash' && items.length > 0 && (
            <div className="space-y-1">
              {items.map((item: TrashItem) => (
                <TrashCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  originalType={item.originalType}
                  language={item.language}
                  onDeletePermanently={onTrashLesson}
                />
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// Helper Accordion component for lessons
function Accordion({ title, isExpanded, onToggle, children }: { title: string, isExpanded: boolean, onToggle: () => void, children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-base font-medium text-gray-300 hover:text-white transition-colors duration-200"
      >
        <span>{title}</span>
        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {isExpanded && (
        <div className="space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
