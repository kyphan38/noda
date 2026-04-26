import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2, CheckCircle2, Globe, Check } from 'lucide-react';
import { DeckItem } from '@/types';
import { PortalMenu } from './PortalMenu';

interface DeckCardProps {
  deck: DeckItem;
  selectedItemId?: string;
  onItemSelect: (item: DeckItem) => void;
  onTrashItem: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}

export function DeckCard({
  deck,
  selectedItemId,
  onItemSelect,
  onTrashItem,
  onRenameLesson,
  onChangeLanguage,
  activeMenu,
  setActiveMenu,
}: DeckCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(deck.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  useEffect(() => {
    setEditName(deck.name);
  }, [deck.name]);

  const langMenuKey = `language-${deck.id}`;
  const mainMenuOpen = activeMenu === deck.id;
  const langMenuOpen = activeMenu === langMenuKey;
  const menuOpen = mainMenuOpen || langMenuOpen;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuBtnRef.current?.contains(t)) return;
      const panel = document.getElementById(`deck-card-menu-${deck.id}`);
      const langPanel = document.getElementById(`deck-lang-menu-${deck.id}`);
      if (panel?.contains(t) || langPanel?.contains(t)) return;
      setActiveMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, deck.id, setActiveMenu]);

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editName.trim() && editName !== deck.name && onRenameLesson) {
      onRenameLesson(deck.id, editName.trim());
    } else {
      setEditName(deck.name);
    }
    setIsRenaming(false);
  };

  return (
    <div
      data-sidebar-item={deck.id}
      onClick={() => {
        if (!isRenaming) onItemSelect(deck);
      }}
      className={`deck-card group relative ml-2 cursor-pointer rounded-md border-l-2 transition-colors duration-200 ${
        selectedItemId === deck.id
          ? 'active border-l-emerald-500 bg-gray-800/50'
          : 'border-l-transparent hover:bg-gray-800/50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 px-2 py-1.5">
        {isRenaming ? (
          <form
            onSubmit={handleRenameSubmit}
            className="flex-1 min-w-0 flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full min-w-0 bg-gray-950 border border-emerald-500/50 text-white text-sm rounded px-1.5 py-0.5 outline-none"
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
          <>
            <h4 className="min-w-0 flex-1 truncate text-xs font-medium text-gray-200" title={deck.name}>
              {deck.name}
            </h4>
            <span className="flex min-w-[1.25rem] shrink-0 items-center justify-end tabular-nums">
              {deck.progress === 0 ? null : deck.progress === 100 ? (
                <span title="Deck complete" className="inline-flex" role="img" aria-label="Deck complete">
                  <CheckCircle2 size={14} className="shrink-0 text-green-400" aria-hidden />
                </span>
              ) : (
                <span className="text-[11px] text-gray-500" title={`Progress: ${deck.progress}%`}>
                  {deck.progress}%
                </span>
              )}
            </span>
            <div className="relative shrink-0">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === deck.id ? null : deck.id);
                }}
                className={`rounded p-0.5 transition-colors ${
                  menuOpen
                    ? 'bg-gray-700 text-white opacity-100'
                    : 'text-gray-400 opacity-100 hover:text-white max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                }`}
                aria-label="Deck actions"
              >
                <MoreVertical size={14} />
              </button>
              <PortalMenu
                menuId={`deck-card-menu-${deck.id}`}
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
                    onTrashItem(deck.id);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </PortalMenu>

              <PortalMenu
                menuId={`deck-lang-menu-${deck.id}`}
                open={langMenuOpen && !!onChangeLanguage}
                anchorRef={menuBtnRef}
                onClose={() => setActiveMenu(null)}
              >
                <button
                  type="button"
                  aria-label="Set language to English"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onChangeLanguage?.(deck.id, 'en');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {deck.language === 'en' ? <Check size={14} className="text-emerald-400" /> : null}
                  </span>
                  en
                </button>
                <button
                  type="button"
                  aria-label="Set language to German"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onChangeLanguage?.(deck.id, 'de');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {deck.language === 'de' ? <Check size={14} className="text-emerald-400" /> : null}
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
