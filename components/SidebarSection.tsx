import React from 'react';
import { Globe, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { LessonSummary, LessonItem, DeckItem, TrashItem } from '@/types';
import { LessonCard } from './LessonCard';
import { DeckCard } from './DeckCard';
import { TrashCard } from './TrashCard';

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
  emptyMessage
}: SidebarSectionProps) {
  const isExpanded = expandedSections[type] ?? (type === 'lessons' || type === 'decks');
  const toggleSection = () => onToggleSection(type, !isExpanded);

  return (
    <div className="space-y-1">
      <button
        onClick={toggleSection}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          {type === 'trash' && <Trash2 size={14} />}
          {title}
        </span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {items.length === 0 && emptyMessage && (
            <div className="px-5 py-2 text-sm text-gray-500 italic">
              {emptyMessage}
            </div>
          )}

          {type === 'lessons' && (
            <>
              {/* English Lessons Accordion */}
              <Accordion 
                title={`🇬🇧 English (${items.filter(i => i.language === 'en').length})`}
                isExpanded={expandedSections['audio-en'] ?? true}
                onToggle={() => onToggleSection('audio-en', !(expandedSections['audio-en'] ?? true))}
              >
                {items.filter(i => i.language === 'en').map((lesson: LessonItem) => (
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

              {/* German Lessons Accordion */}
              <Accordion 
                title={`🇩🇪 German (${items.filter(i => i.language === 'de').length})`}
                isExpanded={expandedSections['audio-de'] ?? false}
                onToggle={() => onToggleSection('audio-de', !(expandedSections['audio-de'] ?? false))}
              >
                {items.filter(i => i.language === 'de').map((lesson: LessonItem) => (
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
            </>
          )}

          {type === 'decks' && (
            <div className="space-y-1">
              {items.map((deck: DeckItem) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  selectedItemId={selectedItemId}
                  onItemSelect={onItemSelect}
                />
              ))}
            </div>
          )}

          {type === 'trash' && (
            <div className="space-y-1">
              {items.length === 0 && !emptyMessage && (
                <div className="px-5 py-2 text-sm text-gray-600 italic">
                  Trash is empty.
                </div>
              )}
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
        className="w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
      >
        <span>{title}</span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isExpanded && (
        <div className="space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
