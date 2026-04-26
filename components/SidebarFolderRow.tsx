'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, MoreVertical, Plus, Trash2, Edit2 } from 'lucide-react';
import type { SidebarFolder } from '@/types';
import { PortalMenu } from './PortalMenu';

export function SidebarFolderRow({
  folder,
  depth,
  isExpanded,
  badgeCount,
  onToggleExpanded,
  onRename,
  onDelete,
  onCreateSubfolder,
  activeMenu,
  setActiveMenu,
}: {
  folder: SidebarFolder;
  depth: number;
  isExpanded: boolean;
  badgeCount: number;
  onToggleExpanded: (next: boolean) => void;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onCreateSubfolder?: () => void | Promise<void>;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(folder.name);
  }, [folder.name]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const menuKey = useMemo(() => `folder-menu-${folder.id}`, [folder.id]);
  const menuOpen = activeMenu === menuKey;

  const indent = depth === 0 ? 'ml-2' : depth === 1 ? 'ml-8' : depth === 2 ? 'ml-14' : 'ml-20';

  return (
    <div className={`${indent} group relative rounded-md`}>
      <div
        className="flex items-center gap-1.5 min-w-0 px-2 py-1.5 rounded-md hover:bg-gray-800/40 transition-colors"
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(!isExpanded)}
          className="shrink-0 text-gray-500 hover:text-gray-200"
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <span className="shrink-0 text-gray-500" aria-hidden>
          <Folder size={14} />
        </span>

        {isRenaming ? (
          <form
            className="flex-1 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              const next = draft.trim();
              setIsRenaming(false);
              if (next && next !== folder.name) void onRename(next);
              else setDraft(folder.name);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const next = draft.trim();
                setIsRenaming(false);
                if (next && next !== folder.name) void onRename(next);
                else setDraft(folder.name);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDraft(folder.name);
                  setIsRenaming(false);
                }
              }}
              className="w-full min-w-0 bg-gray-950 border border-gray-700 text-gray-100 text-xs rounded px-1.5 py-0.5 outline-none focus:border-emerald-500/60"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onToggleExpanded(!isExpanded)}
            className="min-w-0 flex-1 text-left"
            title={folder.name}
          >
            <span className="block truncate text-xs font-medium text-gray-200">{folder.name}</span>
          </button>
        )}

        {!isExpanded && badgeCount > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
            {badgeCount}
          </span>
        )}

        <button
          ref={menuBtnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu(menuOpen ? null : menuKey);
          }}
          className={`shrink-0 rounded p-0.5 transition-colors ${
            menuOpen
              ? 'bg-gray-700 text-white opacity-100'
              : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white focus-visible:opacity-100'
          }`}
          aria-label="Folder actions"
        >
          <MoreVertical size={14} />
        </button>

        <PortalMenu
          menuId={menuKey}
          open={menuOpen}
          anchorRef={menuBtnRef}
          onClose={() => setActiveMenu(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(null);
              setIsRenaming(true);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
          >
            <Edit2 size={14} /> Rename
          </button>
          {depth < 2 && onCreateSubfolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu(null);
                void onCreateSubfolder();
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
            >
              <Plus size={14} /> New subfolder
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(null);
              void onDelete();
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </PortalMenu>
      </div>
    </div>
  );
}

