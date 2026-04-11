import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Wand2, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { LessonItem } from '@/types';

interface LessonCardProps {
  lesson: LessonItem;
  selectedItemId?: string;
  onItemSelect: (item: LessonItem) => void;
  onTrashLesson: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}

export function LessonCard({
  lesson,
  selectedItemId,
  onItemSelect,
  onTrashLesson,
  onRenameLesson,
  activeMenu,
  setActiveMenu
}: LessonCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(lesson.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  useEffect(() => {
    setEditName(lesson.name);
  }, [lesson.name]);

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editName.trim() && editName !== lesson.name && onRenameLesson) {
      onRenameLesson(lesson.id, editName.trim());
    } else {
      setEditName(lesson.name);
    }
    setIsRenaming(false);
  };

  const menuOpen = activeMenu === lesson.id;
  const kebabAlwaysVisible = menuOpen || selectedItemId === lesson.id;

  return (
    <div
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

              {activeMenu === lesson.id && (
                <div className="absolute right-0 top-full mt-0.5 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrashLesson(lesson.id);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 size={14} /> Move to Trash
                  </button>
                </div>
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
