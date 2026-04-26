import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Edit2,
  Trash2,
  Globe,
  Check,
  Video,
  Music2,
} from 'lucide-react';
import { LessonItem } from '@/types';
import { PortalMenu } from './PortalMenu';

interface LessonCardProps {
  lesson: LessonItem;
  selectedItemId?: string;
  onItemSelect: (item: LessonItem) => void;
  onTrashItem: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}

export function LessonCard({
  lesson,
  selectedItemId,
  onItemSelect,
  onTrashItem,
  onRenameLesson,
  onChangeLanguage,
  activeMenu,
  setActiveMenu,
}: LessonCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(lesson.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  useEffect(() => {
    setEditName(lesson.name);
  }, [lesson.name]);

  const langMenuKey = `language-${lesson.id}`;
  const mainMenuOpen = activeMenu === lesson.id;
  const langMenuOpen = activeMenu === langMenuKey;
  const menuOpen = mainMenuOpen || langMenuOpen;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuBtnRef.current?.contains(t)) return;
      const panel = document.getElementById(`lesson-card-menu-${lesson.id}`);
      const langPanel = document.getElementById(`lesson-lang-menu-${lesson.id}`);
      if (panel?.contains(t) || langPanel?.contains(t)) return;
      setActiveMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, lesson.id, setActiveMenu]);

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editName.trim() && editName !== lesson.name && onRenameLesson) {
      onRenameLesson(lesson.id, editName.trim());
    } else {
      setEditName(lesson.name);
    }
    setIsRenaming(false);
  };

  return (
    <div
      data-sidebar-item={lesson.id}
      onClick={() => {
        if (!isRenaming) onItemSelect(lesson);
      }}
      className={`lesson-card group relative ml-2 cursor-pointer rounded-md border-l-2 transition-colors duration-200 ${
        selectedItemId === lesson.id
          ? 'active border-l-emerald-500 bg-gray-800/50'
          : 'border-l-transparent hover:bg-gray-800/50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 px-2 py-1.5">
        {isRenaming ? (
          <form
            onSubmit={handleRenameSubmit}
            className="flex-1 min-w-0 flex items-center"
            onClick={e => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full min-w-0 bg-gray-950 border border-emerald-500/50 text-white text-sm rounded px-1.5 py-0.5 outline-none"
              onBlur={() => handleRenameSubmit()}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setEditName(lesson.name);
                  setIsRenaming(false);
                }
              }}
            />
          </form>
        ) : (
          <>
            <span className="shrink-0 text-gray-500" aria-hidden title={lesson.mediaType === 'video' ? 'Video' : 'Audio'}>
              {lesson.mediaType === 'video' ? (
                <Video size={12} className="shrink-0" />
              ) : (
                <Music2 size={12} className="shrink-0" />
              )}
            </span>
            <h4
              className="min-w-0 flex-1 truncate text-xs font-medium text-gray-200"
              title={lesson.name}
            >
              {lesson.name}
              {!lesson.hasMedia && (
                <span title="Media file missing" className="ml-0.5 inline-flex align-middle">
                  <AlertTriangle size={11} className="inline shrink-0 text-amber-500" />
                </span>
              )}
            </h4>
            <span className="flex min-w-[1.25rem] shrink-0 items-center justify-end tabular-nums">
              {lesson.progress === 0 ? null : lesson.progress === 100 ? (
                <span title="Lesson complete" className="inline-flex" role="img" aria-label="Lesson complete">
                  <CheckCircle2 size={14} className="shrink-0 text-green-400" aria-hidden />
                </span>
              ) : (
                <span className="text-[11px] text-gray-500" title={`Progress: ${lesson.progress}%`}>
                  {lesson.progress}%
                </span>
              )}
            </span>
            <div className="relative shrink-0">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === lesson.id ? null : lesson.id);
                }}
                className={`rounded p-0.5 transition-colors ${
                  menuOpen
                    ? 'bg-gray-700 text-white opacity-100'
                    : 'text-gray-400 opacity-100 hover:text-white max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                }`}
                aria-label="Lesson actions"
              >
                <MoreVertical size={14} />
              </button>

              <PortalMenu
                menuId={`lesson-card-menu-${lesson.id}`}
                open={mainMenuOpen}
                anchorRef={menuBtnRef}
                onClose={() => setActiveMenu(null)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Edit2 size={14} /> Rename
                </button>
                {onChangeLanguage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(langMenuKey);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    <Globe size={14} /> Language
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(null);
                    onTrashItem(lesson.id);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </PortalMenu>

              <PortalMenu
                menuId={`lesson-lang-menu-${lesson.id}`}
                open={langMenuOpen && !!onChangeLanguage}
                anchorRef={menuBtnRef}
                onClose={() => setActiveMenu(null)}
              >
                <button
                  type="button"
                  aria-label="Set language to English"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onChangeLanguage?.(lesson.id, 'en');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {lesson.language === 'en' ? <Check size={14} className="text-emerald-400" /> : null}
                  </span>
                  en
                </button>
                <button
                  type="button"
                  aria-label="Set language to German"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onChangeLanguage?.(lesson.id, 'de');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {lesson.language === 'de' ? <Check size={14} className="text-emerald-400" /> : null}
                  </span>
                  de
                </button>
              </PortalMenu>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
