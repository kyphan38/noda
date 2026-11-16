// Pure rules of the sidebar folder tree: grouping, order, counts, drag payload, moves.

import type { LessonItem, SidebarFolder } from '@/types';

export type DragPayload =
  | { entity: 'item'; id: string; fromFolderId: string | null }
  | { entity: 'folder'; id: string; fromParentId: string | null };

/** Reads the drag payload; null for anything that is not ours. */
export function parseDragPayload(raw: string): DragPayload | null {
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
}

/** A sort key between two neighbours (or past the one that exists). */
export function computeMidSortKey(before?: number, after?: number, now = Date.now()): number {
  if (typeof before === 'number' && typeof after === 'number') return (before + after) / 2;
  if (typeof before === 'number') return before + 1;
  if (typeof after === 'number') return after - 1;
  return now;
}

const bySortKey = (a: SidebarFolder, b: SidebarFolder) => (a.sortKey ?? 0) - (b.sortKey ?? 0);

export function indexFolders(folders: SidebarFolder[]): Map<string, SidebarFolder> {
  const m = new Map<string, SidebarFolder>();
  for (const f of folders) m.set(f.id, f);
  return m;
}

/** Child folders per parent id, in sort-key order. */
export function childrenByParent(folders: SidebarFolder[]): Map<string, SidebarFolder[]> {
  const m = new Map<string, SidebarFolder[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const arr = m.get(f.parentId) ?? [];
    arr.push(f);
    m.set(f.parentId, arr);
  }
  for (const [pid, arr] of m.entries()) {
    arr.sort(bySortKey);
    m.set(pid, arr);
  }
  return m;
}

export function topLevelFolders(folders: SidebarFolder[]): SidebarFolder[] {
  return folders.filter((f) => f.parentId == null).sort(bySortKey);
}

/**
 * Items per folder id (null = root), by name (natural order), then sort key, then id.
 * An item whose folder no longer exists shows at the root.
 */
export function groupItemsByFolder(
  items: LessonItem[],
  foldersById: Map<string, SidebarFolder>,
): Map<string | null, LessonItem[]> {
  const m = new Map<string | null, LessonItem[]>();
  for (const it of items) {
    const raw = it.folderId ?? null;
    const fid = raw && !foldersById.has(raw) ? null : raw;
    const arr = m.get(fid) ?? [];
    arr.push(it);
    m.set(fid, arr);
  }
  for (const [fid, arr] of m.entries()) {
    arr.sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (byName !== 0) return byName;
      const ak = a.sortKey;
      const bk = b.sortKey;
      if (typeof ak === 'number' && typeof bk === 'number' && ak !== bk) return ak - bk;
      return a.id.localeCompare(b.id);
    });
    m.set(fid, arr);
  }
  return m;
}

/** Moving `folderId` under `newParentId` would put it inside itself. */
export function wouldCreateCycle(
  folderId: string,
  newParentId: string | null,
  foldersById: Map<string, SidebarFolder>,
): boolean {
  if (newParentId == null) return false;
  if (newParentId === folderId) return true;
  // Walk up the parent chain from the proposed parent to root.
  let cur: string | null = newParentId;
  let guard = 0;
  while (cur && guard < 20) {
    guard += 1;
    if (cur === folderId) return true;
    cur = foldersById.get(cur)?.parentId ?? null;
  }
  return false;
}

/** Items in each folder and all its sub-folders. A broken loop counts once. */
export function subtreeCounts(
  folders: SidebarFolder[],
  itemsByFolderId: Map<string | null, LessonItem[]>,
  childrenOf: Map<string, SidebarFolder[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  const countSubtree = (fid: string, visiting: Set<string>): number => {
    if (visiting.has(fid)) {
      return 0;
    }
    visiting.add(fid);
    const direct = itemsByFolderId.get(fid)?.length ?? 0;
    const kids = childrenOf.get(fid) ?? [];
    let c = direct;
    for (const k of kids) c += countSubtree(k.id, visiting);
    visiting.delete(fid);
    return c;
  };
  for (const f of folders) {
    out.set(f.id, countSubtree(f.id, new Set()));
  }
  return out;
}
