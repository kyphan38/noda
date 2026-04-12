import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Wand2,
  MoreVertical,
  Edit2,
  Trash2,
  Globe,
  Check,
} from 'lucide-react';
import { LessonItem } from '@/types';

interface LessonCardProps {
  lesson: LessonItem;
  selectedItemId?: string;
  onItemSelect: (item: LessonItem) => void;
  onDeleteLesson: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}

export function LessonCard({
  lesson,
  selectedItemId,
  onItemSelect,
  onDeleteLesson,
  onRenameLesson,
  onChangeLanguage,
  activeMenu,
  setActiveMenu,
}: LessonCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(lesson.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

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

  const kebabAlwaysVisible = menuOpen || selectedItemId === lesson.id;

  return (
    <div
      data-sidebar-item={lesson.id}
      onClick={() => {
        if (!isRenaming) onItemSelect(lesson);
      }}
      className={`relative ml-2 rounded-lg cursor-pointer transition-colors duration-200 group lesson-card ${
        selectedItemId === lesson.id
          ? 'active bg-emerald-500/10 border border-emerald-500'
          : 'hover:bg-gray-800/50 border border-transparent'
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
            <h4
              className="font-medium text-gray-200 text-xs truncate min-w-0 flex-1"
              title={lesson.name}
            >
              {lesson.name}
              {!lesson.hasAudio && (
                <span title="Audio file missing" className="inline-flex align-middle ml-0.5">
                  <AlertTriangle size={11} className="inline text-amber-500 shrink-0" />
                </span>
              )}
            </h4>
            <span className="flex items-center gap-0.5 text-xs text-gray-500 tabular-nums shrink-0">
              <CheckCircle2
                size={11}
                className={lesson.progress === 100 ? 'text-green-400' : 'text-gray-600'}
              />
              {lesson.progress}%
            </span>
            {lesson.hasIpa && (
              <span className="text-purple-400/90 shrink-0" title="IPA generated">
                <Wand2 size={11} />
              </span>
            )}
            <div className="relative shrink-0">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === lesson.id ? null : lesson.id);
                }}
                className={`p-0.5 rounded transition-colors ${
                  menuOpen
                    ? 'bg-gray-700 text-white opacity-100'
                    : kebabAlwaysVisible
                      ? 'text-gray-400 hover:text-white opacity-100'
                      : 'text-gray-500 hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100'
                }`}
                aria-label="Lesson actions"
              >
                <MoreVertical size={14} />
              </button>

              {mainMenuOpen &&
                menuPos &&
                createPortal(
                  <div
                    id={`lesson-card-menu-${lesson.id}`}
                    role="menu"
                    className="fixed w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[210] py-1 overflow-hidden"
                    style={{ top: menuPos.top, right: menuPos.right }}
                    onMouseDown={(e) => e.stopPropagation()}
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
                        <Globe size={14} /> Change language
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(null);
                        onDeleteLesson(lesson.id);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>,
                  document.body
                )}
              {langMenuOpen &&
                menuPos &&
                onChangeLanguage &&
                createPortal(
                  <div
                    id={`lesson-lang-menu-${lesson.id}`}
                    role="menu"
                    className="fixed w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[210] py-1 overflow-hidden"
                    style={{ top: menuPos.top, right: menuPos.right }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label="Set language to English"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onChangeLanguage(lesson.id, 'en');
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
                        void onChangeLanguage(lesson.id, 'de');
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                        {lesson.language === 'de' ? <Check size={14} className="text-emerald-400" /> : null}
                      </span>
                      de
                    </button>
                  </div>,
                  document.body
                )}
            </div>
          </>
        )}
      </div>
      <div className="h-0.5 bg-gray-800/80 mx-2 mb-1 rounded-full overflow-hidden">
        <div
          className={`h-full ${lesson.progress === 100 ? 'bg-green-500/90' : 'bg-emerald-500/80'}`}
          style={{ width: `${lesson.progress}%` }}
        />
      </div>
    </div>
  );
}
