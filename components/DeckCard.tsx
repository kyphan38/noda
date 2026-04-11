import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { DeckItem } from '@/types';

interface DeckCardProps {
  deck: DeckItem;
  selectedItemId?: string;
  onItemSelect: (item: DeckItem) => void;
  onTrashLesson: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}

export function DeckCard({
  deck,
  selectedItemId,
  onItemSelect,
  onTrashLesson,
  onRenameLesson,
  activeMenu,
  setActiveMenu,
}: DeckCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(deck.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const languageFlag: Record<string, string> = {
    en: '🇬🇧',
    de: '🇩🇪',
    mixed: '🌐'
  };

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  useEffect(() => {
    setEditName(deck.name);
  }, [deck.name]);

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editName.trim() && editName !== deck.name && onRenameLesson) {
      onRenameLesson(deck.id, editName.trim());
    } else {
      setEditName(deck.name);
    }
    setIsRenaming(false);
  };

  const menuOpen = activeMenu === deck.id;
  const kebabAlwaysVisible = menuOpen || selectedItemId === deck.id;

  return (
    <div
      onClick={() => {
        if (!isRenaming) onItemSelect(deck);
      }}
      className={`group relative flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-lg cursor-pointer transition-colors duration-200 mb-1 deck-card border ${
        selectedItemId === deck.id
          ? 'active border-emerald-500 bg-emerald-500/10'
          : 'border-gray-700/80 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60'
      }`}
    >
      <span className="text-sm shrink-0 opacity-80" aria-hidden>
        🎴
      </span>
      {isRenaming ? (
        <form
          className="flex-1 min-w-0"
          onSubmit={handleRenameSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full min-w-0 bg-gray-950 border border-blue-500/50 text-white text-sm rounded px-1.5 py-0.5 outline-none"
            onBlur={() => handleRenameSubmit()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditName(deck.name);
                setIsRenaming(false);
              }
            }}
          />
        </form>
      ) : (
        <span className="font-medium text-gray-200 text-sm truncate min-w-0 flex-1" title={deck.name}>
          {deck.name}
        </span>
      )}
      <span className="text-xs text-gray-500 tabular-nums shrink-0 whitespace-nowrap">{deck.cardCount} cards</span>
      <span className="text-sm shrink-0" title={deck.language}>
        {languageFlag[deck.language] || '🌐'}
      </span>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu(activeMenu === deck.id ? null : deck.id);
          }}
          className={`p-0.5 rounded transition-colors ${
            menuOpen
              ? 'bg-gray-700 text-white opacity-100'
              : kebabAlwaysVisible
                ? 'text-gray-400 hover:text-white opacity-100'
                : 'text-gray-500 hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100'
          }`}
          aria-label="Deck actions"
        >
          <MoreVertical size={14} />
        </button>
        {activeMenu === deck.id && (
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
                onTrashLesson(deck.id);
                setActiveMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
            >
              <Trash2 size={14} /> Move to Trash
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
