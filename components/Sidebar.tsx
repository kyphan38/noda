'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Music2,
  Layers,
  LogOut,
  PanelLeft,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { LessonSummary, ExpandedSections, LessonItem, DeckItem } from '@/types';
import { SidebarSection } from './SidebarSection';

function TrashedItemRow({
  item,
  onRestoreItem,
  onDeleteForever,
}: {
  item: LessonSummary;
  onRestoreItem: (id: string) => void;
  onDeleteForever: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const el = menuBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuBtnRef.current?.contains(t)) return;
      const panel = document.getElementById(`trash-row-menu-${item.id}`);
      if (panel?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, item.id]);

  return (
    <li
      className="group rounded-lg border border-gray-800 bg-gray-900/40 px-2 py-2 text-xs relative ml-2"
    >
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-left text-gray-200 font-medium truncate flex-1 min-w-0">
          {item.name}
          <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
            {item.kind === 'flashcard' ? 'Deck' : 'Lesson'}
            {item.trashedAt != null ? ` · ${new Date(item.trashedAt).toLocaleString()}` : ''}
          </span>
        </div>
        <div className="relative shrink-0">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className={`p-0.5 rounded transition-colors ${
              menuOpen
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white opacity-100'
            }`}
            aria-label="Trashed item actions"
          >
            <MoreVertical size={14} />
          </button>

          {menuOpen &&
            menuPos &&
            createPortal(
              <div
                id={`trash-row-menu-${item.id}`}
                role="menu"
                className="fixed w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[210] py-1 overflow-hidden"
                style={{ top: menuPos.top, right: menuPos.right }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRestoreItem(item.id);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 flex items-center gap-2 transition-colors"
                >
                  <RotateCcw size={14} aria-hidden />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDeleteForever(item.id);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} aria-hidden />
                  Delete
                </button>
              </div>,
              document.body
            )}
        </div>
      </div>
    </li>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  lessons: LessonSummary[];
  isListLoading?: boolean;
  selectedItemId?: string;
  expandedSections: ExpandedSections;
  onItemSelect: (item: LessonItem | DeckItem) => void;
  onNewLesson: () => void;
  onNewDeck: () => void;
  onTrashItem: (id: string) => void;
  onRestoreItem: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
  onLogout: () => void;
  onToggleSection: (section: string, expanded: boolean) => void;
  isMobile?: boolean;
}

export function Sidebar({
  isOpen,
  onToggle,
  lessons,
  isListLoading = false,
  selectedItemId,
  expandedSections,
  onItemSelect,
  onNewLesson,
  onNewDeck,
  onTrashItem,
  onRestoreItem,
  onDeleteForever,
  onRenameLesson,
  onChangeLanguage,
  onLogout,
  onToggleSection,
  isMobile = false,
}: SidebarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const activeLessons: LessonItem[] = lessons
    .filter((l) => !l.isTrashed && l.kind === 'audio')
    .map((l) => ({
      id: l.id,
      name: l.name,
      language: l.language as 'en' | 'de',
      progress: l.progress,
      hasMedia: l.hasMedia,
      mediaType: l.mediaType,
      type: 'lesson',
    }));

  const activeDecks: DeckItem[] = lessons
    .filter((l) => !l.isTrashed && l.kind === 'flashcard')
    .map((l) => ({
      id: l.id,
      name: l.name,
      language: l.language as 'en' | 'de' | 'mixed',
      cardCount: l.totalSentences,
      progress: l.progress,
      type: 'deck',
    }));

  const trashed = lessons.filter((l) => l.isTrashed);
  const trashExpanded = expandedSections.trash ?? false;

  const flexColWidth = isMobile ? 'w-0' : isOpen ? 'w-72' : 'w-0';

  return (
    <>
      {isMobile && isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/50 touch-manipulation"
          onClick={() => onToggle(false)}
        />
      )}
      <div
        className={`shrink-0 transition-all duration-300 ease-in-out ${flexColWidth} relative z-50`}
      >
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">noda</h2>
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

          {!isMobile && (
            <div className="actions-container flex flex-row gap-2 p-4">
              <button
                onClick={onNewLesson}
                className="btn-new-lesson flex-1 py-2.5 px-2 text-sm bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors duration-200"
                title="New audio lesson"
              >
                <Music2 size={16} aria-hidden />
                <span>+ Audio</span>
              </button>
              <button
                onClick={onNewDeck}
                className="btn-new-deck flex-1 py-2.5 px-2 text-sm bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors duration-200"
                title="New flashcard deck"
              >
                <Layers size={16} aria-hidden />
                <span>+ Deck</span>
              </button>
            </div>
          )}

          {isMobile && (
            <div className="actions-container flex flex-row gap-2 p-4">
              <button
                onClick={onNewDeck}
                className="btn-new-deck flex-1 py-2.5 px-2 text-sm bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors duration-200"
                title="New flashcard deck"
              >
                <Layers size={16} aria-hidden />
                <span>+ Deck</span>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-6">
            {!isMobile && (
              <SidebarSection
                type="lessons"
                title="AUDIO"
                items={activeLessons}
                isLoading={isListLoading}
                selectedItemId={selectedItemId}
                expandedSections={expandedSections}
                onToggleSection={onToggleSection}
                onItemSelect={onItemSelect}
                onTrashItem={onTrashItem}
                onRenameLesson={onRenameLesson}
                onChangeLanguage={onChangeLanguage}
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
              />
            )}

            <SidebarSection
              type="decks"
              title="DECKS"
              items={activeDecks}
              isLoading={isListLoading}
              selectedItemId={selectedItemId}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onItemSelect={onItemSelect}
              onTrashItem={onTrashItem}
              onRenameLesson={onRenameLesson}
              onChangeLanguage={onChangeLanguage}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
            />

            {trashed.length > 0 && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => onToggleSection('trash', !trashExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors duration-200"
                >
                  <span className="flex items-center gap-2">
                    {trashExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Trash ({trashed.length})
                  </span>
                </button>
                {trashExpanded && (
                  <ul className="space-y-1 pl-1">
                    {trashed.map((l) => (
                      <TrashedItemRow
                        key={l.id}
                        item={l}
                        onRestoreItem={onRestoreItem}
                        onDeleteForever={onDeleteForever}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
