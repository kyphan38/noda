'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { DeckItem, LessonItem, SidebarFolder } from '@/types';
import { SidebarFolderRow } from './SidebarFolderRow';
import { LessonCard } from './LessonCard';
import { DeckCard } from './DeckCard';
import { InlineCreateInput } from './InlineCreateInput';

type AnyItem = LessonItem | DeckItem;

function folderKey(id: string): string {
  return `folder:${id}`;
}

const MAX_VISIBLE_PER_CONTAINER = 10;

export function SidebarFolderTree({
  kind,
  language,
  items,
  folders,
  selectedItemId,
  expandedSections,
  forcedExpandedFolderIds,
  disableCaps = false,
  onToggleSection,
  onItemSelect,
  onTrashItem,
  onRenameLesson,
  onChangeLanguage,
  activeMenu,
  setActiveMenu,
  enableDnd = false,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem,
  onMoveFolder,
}: {
  kind: 'audio' | 'flashcard';
  language: 'en' | 'de';
  items: AnyItem[];
  folders: SidebarFolder[];
  selectedItemId?: string;
  expandedSections: Record<string, boolean>;
  forcedExpandedFolderIds?: Set<string>;
  disableCaps?: boolean;
  onToggleSection: (section: string, expanded: boolean) => void;
  onItemSelect: (item: AnyItem) => void;
  onTrashItem: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
  enableDnd?: boolean;
  onCreateFolder: (params: { name: string; parentId: string | null }) => void | Promise<void>;
  onRenameFolder: (id: string, name: string) => void | Promise<void>;
  onDeleteFolder: (id: string) => void | Promise<void>;
  onMoveItem: (itemId: string, folderId: string | null, sortKey: number) => void | Promise<void>;
  onMoveFolder: (folderId: string, parentId: string | null, sortKey: number) => void | Promise<void>;
}) {
  type DragPayload =
    | { entity: 'item'; id: string; fromFolderId: string | null }
    | { entity: 'folder'; id: string; fromParentId: string | null };

  const dragRef = useRef<DragPayload | null>(null);

  const parsePayload = (e: React.DragEvent): DragPayload | null => {
    const raw =
      e.dataTransfer.getData('application/x-noda-sidebar-dnd') || e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as DragPayload;
      if (!j || typeof j !== 'object') return null;
      if (j.entity === 'item' && typeof (j as { id?: unknown }).id === 'string') return j;
      if (j.entity === 'folder' && typeof (j as { id?: unknown }).id === 'string') return j;
      return null;
    } catch {
      return null;
    }
  };

  const getPayload = (e: React.DragEvent): DragPayload | null => {
    // Some browsers expose types but return empty data during dragover/drop.
    return parsePayload(e) ?? dragRef.current;
  };

  const computeMidSortKey = (before?: number, after?: number): number => {
    if (typeof before === 'number' && typeof after === 'number') return (before + after) / 2;
    if (typeof before === 'number') return before + 1;
    if (typeof after === 'number') return after - 1;
    return Date.now();
  };

  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(() => new Set());
  const [creatingSubfolderFor, setCreatingSubfolderFor] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<null | { targetId: string; position: 'before' | 'after' }>(null);

  const setOverTargetIfChanged = (next: { targetId: string; position: 'before' | 'after' } | null) => {
    setOverTarget((prev) => {
      if (prev?.targetId === next?.targetId && prev?.position === next?.position) return prev;
      return next;
    });
  };

  const foldersById = useMemo(() => {
    const m = new Map<string, SidebarFolder>();
    for (const f of folders) m.set(f.id, f);
    return m;
  }, [folders]);

  const childrenOf = useMemo(() => {
    const m = new Map<string, SidebarFolder[]>();
    for (const f of folders) {
      if (!f.parentId) continue;
      const arr = m.get(f.parentId) ?? [];
      arr.push(f);
      m.set(f.parentId, arr);
    }
    for (const [pid, arr] of m.entries()) {
      arr.sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0));
      m.set(pid, arr);
    }
    return m;
  }, [folders]);

  const topFolders = useMemo(
    () => folders.filter((f) => f.parentId == null).sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0)),
    [folders]
  );

  const itemsByFolderId = useMemo(() => {
    const m = new Map<string | null, AnyItem[]>();
    for (const it of items) {
      const raw = (it as AnyItem).folderId ?? null;
      const fid = raw && !foldersById.has(raw) ? null : raw;
      const arr = m.get(fid) ?? [];
      arr.push(it);
      m.set(fid, arr);
    }
    for (const [fid, arr] of m.entries()) {
      arr.sort((a, b) => {
        const ak = a.sortKey;
        const bk = b.sortKey;
        if (typeof ak === 'number' && typeof bk === 'number' && ak !== bk) return ak - bk;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      m.set(fid, arr);
    }
    return m;
  }, [items, foldersById]);

  const subtreeCountByFolderId = useMemo(() => {
    const out = new Map<string, number>();
    const countSubtree = (fid: string): number => {
      const direct = itemsByFolderId.get(fid)?.length ?? 0;
      const kids = childrenOf.get(fid) ?? [];
      let c = direct;
      for (const k of kids) c += countSubtree(k.id);
      return c;
    };
    for (const f of folders) {
      out.set(f.id, countSubtree(f.id));
    }
    return out;
  }, [folders, itemsByFolderId, childrenOf]);

  const rootItems = itemsByFolderId.get(null) ?? [];

  const showAllKeyRoot = 'root';
  const rootShowAll = expandedContainers.has(showAllKeyRoot);
  const rootRender = disableCaps
    ? rootItems
    : rootShowAll
      ? rootItems
      : rootItems.slice(0, MAX_VISIBLE_PER_CONTAINER);

  return (
    <div className="space-y-1">
      {/* Root items pinned above folders */}
      <div
        onDragOver={(e) => {
          if (!enableDnd) return;
          const p = getPayload(e);
          if (!p || p.entity !== 'item') return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (!enableDnd) return;
          const p = getPayload(e);
          if (!p || p.entity !== 'item') return;
          e.preventDefault();
          const list = itemsByFolderId.get(null) ?? [];
          const after = list[0]?.sortKey;
          const nextSortKey = computeMidSortKey(undefined, typeof after === 'number' ? after : undefined);
          void onMoveItem(p.id, null, nextSortKey);
        }}
      >
        {rootRender.map((it) => {
          const containerId: string | null = null;
          const list = itemsByFolderId.get(containerId) ?? [];
          const idx = list.findIndex((x) => x.id === it.id);
          const beforeKey = idx > 0 ? list[idx - 1]?.sortKey : undefined;
          const afterKey = idx >= 0 ? list[idx + 1]?.sortKey : undefined;

          const payload: DragPayload = { entity: 'item', id: it.id, fromFolderId: containerId };

          return (
            <div
              key={it.id}
              className="relative"
              draggable={enableDnd}
              onDragStart={(e) => {
                if (!enableDnd) return;
                dragRef.current = payload;
                const raw = JSON.stringify(payload);
                e.dataTransfer.setData('application/x-noda-sidebar-dnd', raw);
                e.dataTransfer.setData('text/plain', raw);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!enableDnd) return;
                const p = getPayload(e);
                if (!p || p.entity !== 'item') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const before = e.clientY < r.top + r.height / 2;
                setOverTargetIfChanged({ targetId: it.id, position: before ? 'before' : 'after' });
              }}
              onDrop={(e) => {
                if (!enableDnd) return;
                const p = getPayload(e);
                if (!p || p.entity !== 'item') return;
                e.preventDefault();
                setOverTargetIfChanged(null);
                const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const before = e.clientY < r.top + r.height / 2;
                const nextSortKey = before
                  ? computeMidSortKey(
                      typeof beforeKey === 'number' ? beforeKey : undefined,
                      typeof it.sortKey === 'number' ? it.sortKey : undefined
                    )
                  : computeMidSortKey(
                      typeof it.sortKey === 'number' ? it.sortKey : undefined,
                      typeof afterKey === 'number' ? afterKey : undefined
                    );
                void onMoveItem(p.id, containerId, nextSortKey);
              }}
              onDragLeave={() => {
                if (!enableDnd) return;
                setOverTargetIfChanged(null);
              }}
            >
              {enableDnd && overTarget?.targetId === it.id && (
                <div
                  className="absolute left-2 right-2 h-0.5 bg-emerald-500 pointer-events-none"
                  style={{ top: overTarget.position === 'before' ? 0 : '100%' }}
                />
              )}
              {it.type === 'lesson' ? (
                <LessonCard
                  lesson={it as LessonItem}
                  selectedItemId={selectedItemId}
                  onItemSelect={onItemSelect as (x: LessonItem) => void}
                  onTrashItem={onTrashItem}
                  onRenameLesson={onRenameLesson}
                  onChangeLanguage={onChangeLanguage}
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                />
              ) : (
                <DeckCard
                  deck={it as DeckItem}
                  selectedItemId={selectedItemId}
                  onItemSelect={onItemSelect as (x: DeckItem) => void}
                  onTrashItem={onTrashItem}
                  onRenameLesson={onRenameLesson}
                  onChangeLanguage={onChangeLanguage}
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                />
              )}
            </div>
          );
        })}
      </div>

      {!disableCaps && rootItems.length > MAX_VISIBLE_PER_CONTAINER && (
        <button
          type="button"
          onClick={() =>
            setExpandedContainers((prev) => {
              const next = new Set(prev);
              if (next.has(showAllKeyRoot)) next.delete(showAllKeyRoot);
              else next.add(showAllKeyRoot);
              return next;
            })
          }
          className="ml-2 text-[11px] text-gray-400 hover:text-gray-200 px-2 py-1"
        >
          {rootShowAll ? `Show less` : `Show all (${rootItems.length})`}
        </button>
      )}

      {/* Folder rows */}

      {topFolders.map((f) => {
        const key = folderKey(f.id);
        const forced = forcedExpandedFolderIds?.has(f.id) ?? false;
        const expanded = forced || (expandedSections[key] ?? false);
        const badge = subtreeCountByFolderId.get(f.id) ?? 0;
        const subfolders = childrenOf.get(f.id) ?? [];
        const directItems = itemsByFolderId.get(f.id) ?? [];

        const folderContainerKey = `folder:${f.id}:items`;
        const folderShowAll = expandedContainers.has(folderContainerKey);
        const folderRender = disableCaps
          ? directItems
          : folderShowAll
            ? directItems
            : directItems.slice(0, MAX_VISIBLE_PER_CONTAINER);

        return (
          <div key={f.id} className="space-y-1">
            <div
              draggable={enableDnd}
              className="relative"
              onDragStart={(e) => {
                if (!enableDnd) return;
                const payload: DragPayload = { entity: 'folder', id: f.id, fromParentId: null };
                dragRef.current = payload;
                const raw = JSON.stringify(payload);
                e.dataTransfer.setData('application/x-noda-sidebar-dnd', raw);
                e.dataTransfer.setData('text/plain', raw);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!enableDnd) return;
                const p = getPayload(e);
                if (!p) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (p.entity !== 'folder') return;
                const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const before = e.clientY < r.top + r.height / 2;
                setOverTargetIfChanged({ targetId: f.id, position: before ? 'before' : 'after' });
              }}
              onDrop={(e) => {
                if (!enableDnd) return;
                const p = getPayload(e);
                if (!p) return;
                e.preventDefault();
                setOverTargetIfChanged(null);

                if (p.entity === 'item') {
                  const list = itemsByFolderId.get(f.id) ?? [];
                  const last = list[list.length - 1]?.sortKey;
                  const nextSortKey = computeMidSortKey(typeof last === 'number' ? last : undefined, undefined);
                  void onMoveItem(p.id, f.id, nextSortKey);
                  return;
                }

                if (p.entity === 'folder' && p.id !== f.id) {
                  const siblings = topFolders;
                  const targetIdx = siblings.findIndex((x) => x.id === f.id);
                  const beforeKey = targetIdx > 0 ? siblings[targetIdx - 1]?.sortKey : undefined;
                  const afterKey = targetIdx >= 0 ? siblings[targetIdx + 1]?.sortKey : undefined;

                  const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const before = e.clientY < r.top + r.height / 2;
                  const nextSortKey = before
                    ? computeMidSortKey(
                        typeof beforeKey === 'number' ? beforeKey : undefined,
                        typeof f.sortKey === 'number' ? f.sortKey : undefined
                      )
                    : computeMidSortKey(
                        typeof f.sortKey === 'number' ? f.sortKey : undefined,
                        typeof afterKey === 'number' ? afterKey : undefined
                      );
                  void onMoveFolder(p.id, null, nextSortKey);
                }
              }}
              onDragLeave={() => {
                if (!enableDnd) return;
                setOverTargetIfChanged(null);
              }}
            >
              {enableDnd && overTarget?.targetId === f.id && dragRef.current?.entity === 'folder' && (
                <div
                  className="absolute left-2 right-2 h-0.5 bg-emerald-500 pointer-events-none"
                  style={{ top: overTarget.position === 'before' ? 0 : '100%' }}
                />
              )}
              <SidebarFolderRow
                folder={f}
                depth={0}
                isExpanded={expanded}
                badgeCount={badge}
                onToggleExpanded={(next) => onToggleSection(key, next)}
                onRename={(name) => onRenameFolder(f.id, name)}
                onDelete={() => onDeleteFolder(f.id)}
                onCreateSubfolder={() => setCreatingSubfolderFor(f.id)}
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
              />
            </div>

            {creatingSubfolderFor === f.id && (
              <div className="ml-6 px-2 py-1">
                <InlineCreateInput
                  placeholder="New subfolder…"
                  onCommit={(name) => onCreateFolder({ name, parentId: f.id })}
                  onCancel={() => setCreatingSubfolderFor(null)}
                />
              </div>
            )}

            {expanded && (
              <div className="space-y-1">
                {folderRender.map((it) => {
                  const list = itemsByFolderId.get(f.id) ?? [];
                  const idx = list.findIndex((x) => x.id === it.id);
                  const beforeKey = idx > 0 ? list[idx - 1]?.sortKey : undefined;
                  const afterKey = idx >= 0 ? list[idx + 1]?.sortKey : undefined;
                  const payload: DragPayload = { entity: 'item', id: it.id, fromFolderId: f.id };

                  return (
                    <div
                      key={it.id}
                      className="relative"
                      draggable={enableDnd}
                      onDragStart={(e) => {
                        if (!enableDnd) return;
                        dragRef.current = payload;
                        const raw = JSON.stringify(payload);
                        e.dataTransfer.setData('application/x-noda-sidebar-dnd', raw);
                        e.dataTransfer.setData('text/plain', raw);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        if (!enableDnd) return;
                        const p = getPayload(e);
                        if (!p || p.entity !== 'item') return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const before = e.clientY < r.top + r.height / 2;
                        setOverTargetIfChanged({ targetId: it.id, position: before ? 'before' : 'after' });
                      }}
                      onDrop={(e) => {
                        if (!enableDnd) return;
                        const p = getPayload(e);
                        if (!p || p.entity !== 'item') return;
                        e.preventDefault();
                        setOverTargetIfChanged(null);
                        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const before = e.clientY < r.top + r.height / 2;
                        const nextSortKey = before
                          ? computeMidSortKey(
                              typeof beforeKey === 'number' ? beforeKey : undefined,
                              typeof it.sortKey === 'number' ? it.sortKey : undefined
                            )
                          : computeMidSortKey(
                              typeof it.sortKey === 'number' ? it.sortKey : undefined,
                              typeof afterKey === 'number' ? afterKey : undefined
                            );
                        void onMoveItem(p.id, f.id, nextSortKey);
                      }}
                      onDragLeave={() => {
                        if (!enableDnd) return;
                        setOverTargetIfChanged(null);
                      }}
                    >
                      {enableDnd && overTarget?.targetId === it.id && (
                        <div
                          className="absolute left-2 right-2 h-0.5 bg-emerald-500 pointer-events-none"
                          style={{ top: overTarget.position === 'before' ? 0 : '100%' }}
                        />
                      )}
                      {it.type === 'lesson' ? (
                        <div className="ml-4">
                          <LessonCard
                            lesson={it as LessonItem}
                            selectedItemId={selectedItemId}
                            onItemSelect={onItemSelect as (x: LessonItem) => void}
                            onTrashItem={onTrashItem}
                            onRenameLesson={onRenameLesson}
                            onChangeLanguage={onChangeLanguage}
                            activeMenu={activeMenu}
                            setActiveMenu={setActiveMenu}
                          />
                        </div>
                      ) : (
                        <div className="ml-4">
                          <DeckCard
                            deck={it as DeckItem}
                            selectedItemId={selectedItemId}
                            onItemSelect={onItemSelect as (x: DeckItem) => void}
                            onTrashItem={onTrashItem}
                            onRenameLesson={onRenameLesson}
                            onChangeLanguage={onChangeLanguage}
                            activeMenu={activeMenu}
                            setActiveMenu={setActiveMenu}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {!disableCaps && directItems.length > MAX_VISIBLE_PER_CONTAINER && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedContainers((prev) => {
                        const next = new Set(prev);
                        if (next.has(folderContainerKey)) next.delete(folderContainerKey);
                        else next.add(folderContainerKey);
                        return next;
                      })
                    }
                    className="ml-6 text-[11px] text-gray-400 hover:text-gray-200 px-2 py-1"
                  >
                    {folderShowAll ? `Show less` : `Show all (${directItems.length})`}
                  </button>
                )}

                {subfolders.map((sf) => {
                  const sfKey = folderKey(sf.id);
                  const sfForced = forcedExpandedFolderIds?.has(sf.id) ?? false;
                  const sfExpanded = sfForced || (expandedSections[sfKey] ?? false);
                  const sfBadge = subtreeCountByFolderId.get(sf.id) ?? 0;
                  const sfItems = itemsByFolderId.get(sf.id) ?? [];

                  const sfContainerKey = `subfolder:${sf.id}:items`;
                  const sfShowAll = expandedContainers.has(sfContainerKey);
                  const sfRender = disableCaps
                    ? sfItems
                    : sfShowAll
                      ? sfItems
                      : sfItems.slice(0, MAX_VISIBLE_PER_CONTAINER);

                  return (
                    <div key={sf.id} className="space-y-1">
                      <div
                        onDragOver={(e) => {
                          if (!enableDnd) return;
                          const p = getPayload(e);
                          if (!p || p.entity !== 'item') return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          if (!enableDnd) return;
                          const p = getPayload(e);
                          if (!p || p.entity !== 'item') return;
                          e.preventDefault();
                          const list = itemsByFolderId.get(sf.id) ?? [];
                          const last = list[list.length - 1]?.sortKey;
                          const nextSortKey = computeMidSortKey(typeof last === 'number' ? last : undefined, undefined);
                          void onMoveItem(p.id, sf.id, nextSortKey);
                        }}
                      >
                        <SidebarFolderRow
                          folder={sf}
                          depth={1}
                          isExpanded={sfExpanded}
                          badgeCount={sfBadge}
                          onToggleExpanded={(next) => onToggleSection(sfKey, next)}
                          onRename={(name) => onRenameFolder(sf.id, name)}
                          onDelete={() => onDeleteFolder(sf.id)}
                          activeMenu={activeMenu}
                          setActiveMenu={setActiveMenu}
                        />
                      </div>

                      {sfExpanded && (
                        <div className="space-y-1">
                          {sfRender.map((it) => {
                            const list = itemsByFolderId.get(sf.id) ?? [];
                            const idx = list.findIndex((x) => x.id === it.id);
                            const beforeKey = idx > 0 ? list[idx - 1]?.sortKey : undefined;
                            const afterKey = idx >= 0 ? list[idx + 1]?.sortKey : undefined;
                            const payload: DragPayload = { entity: 'item', id: it.id, fromFolderId: sf.id };

                            return (
                              <div
                                key={it.id}
                                className="relative"
                                draggable={enableDnd}
                                onDragStart={(e) => {
                                  if (!enableDnd) return;
                                  dragRef.current = payload;
                                  const raw = JSON.stringify(payload);
                                  e.dataTransfer.setData('application/x-noda-sidebar-dnd', raw);
                                  e.dataTransfer.setData('text/plain', raw);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                  if (!enableDnd) return;
                                  const p = getPayload(e);
                                  if (!p || p.entity !== 'item') return;
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                  const before = e.clientY < r.top + r.height / 2;
                                  setOverTargetIfChanged({ targetId: it.id, position: before ? 'before' : 'after' });
                                }}
                                onDrop={(e) => {
                                  if (!enableDnd) return;
                                  const p = getPayload(e);
                                  if (!p || p.entity !== 'item') return;
                                  e.preventDefault();
                                  setOverTargetIfChanged(null);
                                  const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                  const before = e.clientY < r.top + r.height / 2;
                                  const nextSortKey = before
                                    ? computeMidSortKey(
                                        typeof beforeKey === 'number' ? beforeKey : undefined,
                                        typeof it.sortKey === 'number' ? it.sortKey : undefined
                                      )
                                    : computeMidSortKey(
                                        typeof it.sortKey === 'number' ? it.sortKey : undefined,
                                        typeof afterKey === 'number' ? afterKey : undefined
                                      );
                                  void onMoveItem(p.id, sf.id, nextSortKey);
                                }}
                                onDragLeave={() => {
                                  if (!enableDnd) return;
                                  setOverTargetIfChanged(null);
                                }}
                              >
                                {enableDnd && overTarget?.targetId === it.id && (
                                  <div
                                    className="absolute left-2 right-2 h-0.5 bg-emerald-500 pointer-events-none"
                                    style={{ top: overTarget.position === 'before' ? 0 : '100%' }}
                                  />
                                )}
                                {it.type === 'lesson' ? (
                                  <div className="ml-10">
                                    <LessonCard
                                      lesson={it as LessonItem}
                                      selectedItemId={selectedItemId}
                                      onItemSelect={onItemSelect as (x: LessonItem) => void}
                                      onTrashItem={onTrashItem}
                                      onRenameLesson={onRenameLesson}
                                      onChangeLanguage={onChangeLanguage}
                                      activeMenu={activeMenu}
                                      setActiveMenu={setActiveMenu}
                                    />
                                  </div>
                                ) : (
                                  <div className="ml-10">
                                    <DeckCard
                                      deck={it as DeckItem}
                                      selectedItemId={selectedItemId}
                                      onItemSelect={onItemSelect as (x: DeckItem) => void}
                                      onTrashItem={onTrashItem}
                                      onRenameLesson={onRenameLesson}
                                      onChangeLanguage={onChangeLanguage}
                                      activeMenu={activeMenu}
                                      setActiveMenu={setActiveMenu}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {!disableCaps && sfItems.length > MAX_VISIBLE_PER_CONTAINER && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedContainers((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(sfContainerKey)) next.delete(sfContainerKey);
                                  else next.add(sfContainerKey);
                                  return next;
                                })
                              }
                              className="ml-10 text-[11px] text-gray-400 hover:text-gray-200 px-2 py-1"
                            >
                              {sfShowAll ? `Show less` : `Show all (${sfItems.length})`}
                            </button>
                          )}

                          {/* level 3 folders */}
                          {(childrenOf.get(sf.id) ?? []).map((tf) => {
                            const tfKey = folderKey(tf.id);
                            const tfForced = forcedExpandedFolderIds?.has(tf.id) ?? false;
                            const tfExpanded = tfForced || (expandedSections[tfKey] ?? false);
                            const tfBadge = subtreeCountByFolderId.get(tf.id) ?? 0;
                            const tfItems = itemsByFolderId.get(tf.id) ?? [];

                            const tfContainerKey = `subsubfolder:${tf.id}:items`;
                            const tfShowAll = expandedContainers.has(tfContainerKey);
                            const tfRender = disableCaps
                              ? tfItems
                              : tfShowAll
                                ? tfItems
                                : tfItems.slice(0, MAX_VISIBLE_PER_CONTAINER);

                            return (
                              <div key={tf.id} className="space-y-1">
                                <div
                                  onDragOver={(e) => {
                                    if (!enableDnd) return;
                                    const p = getPayload(e);
                                    if (!p || p.entity !== 'item') return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    if (!enableDnd) return;
                                    const p = getPayload(e);
                                    if (!p || p.entity !== 'item') return;
                                    e.preventDefault();
                                    const list = itemsByFolderId.get(tf.id) ?? [];
                                    const last = list[list.length - 1]?.sortKey;
                                    const nextSortKey = computeMidSortKey(typeof last === 'number' ? last : undefined, undefined);
                                    void onMoveItem(p.id, tf.id, nextSortKey);
                                  }}
                                >
                                  <SidebarFolderRow
                                    folder={tf}
                                    depth={2}
                                    isExpanded={tfExpanded}
                                    badgeCount={tfBadge}
                                    onToggleExpanded={(next) => onToggleSection(tfKey, next)}
                                    onRename={(name) => onRenameFolder(tf.id, name)}
                                    onDelete={() => onDeleteFolder(tf.id)}
                                    activeMenu={activeMenu}
                                    setActiveMenu={setActiveMenu}
                                  />
                                </div>

                                {tfExpanded && (
                                  <div className="space-y-1">
                                    {tfRender.map((it) => (
                                      <div key={it.id} className="ml-16">
                                        {it.type === 'lesson' ? (
                                          <LessonCard
                                            lesson={it as LessonItem}
                                            selectedItemId={selectedItemId}
                                            onItemSelect={onItemSelect as (x: LessonItem) => void}
                                            onTrashItem={onTrashItem}
                                            onRenameLesson={onRenameLesson}
                                            onChangeLanguage={onChangeLanguage}
                                            activeMenu={activeMenu}
                                            setActiveMenu={setActiveMenu}
                                          />
                                        ) : (
                                          <DeckCard
                                            deck={it as DeckItem}
                                            selectedItemId={selectedItemId}
                                            onItemSelect={onItemSelect as (x: DeckItem) => void}
                                            onTrashItem={onTrashItem}
                                            onRenameLesson={onRenameLesson}
                                            onChangeLanguage={onChangeLanguage}
                                            activeMenu={activeMenu}
                                            setActiveMenu={setActiveMenu}
                                          />
                                        )}
                                      </div>
                                    ))}

                                    {!disableCaps && tfItems.length > MAX_VISIBLE_PER_CONTAINER && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedContainers((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(tfContainerKey)) next.delete(tfContainerKey);
                                            else next.add(tfContainerKey);
                                            return next;
                                          })
                                        }
                                        className="ml-14 text-[11px] text-gray-400 hover:text-gray-200 px-2 py-1"
                                      >
                                        {tfShowAll ? `Show less` : `Show all (${tfItems.length})`}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
