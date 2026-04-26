import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/auth/firebase-client';
import {
  createSidebarFolderFirestore,
  deleteSidebarFolderFirestore,
  moveSidebarFolderFirestore,
  patchLessonSidebarPlacementFirestore,
  renameSidebarFolderFirestore,
  subscribeSidebarFoldersFirestore,
  type SidebarFolderLanguage,
  type SidebarFolderKind,
  type SidebarFolderRecord,
} from '@/lib/db';
import type { SidebarFolder, SidebarKind, SidebarLanguage } from '@/types';

type FolderOverride = Partial<SidebarFolder>;
type ItemOverride = { folderId: string | null; sortKey: number };

export type UseFoldersResult = {
  folders: SidebarFolder[];
  localOverrides: {
    folders: Record<string, FolderOverride>;
    items: Record<string, ItemOverride>;
  };
  createFolder(params: {
    name: string;
    kind: SidebarKind;
    language: SidebarLanguage;
    parentId: string | null;
  }): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  moveFolder(id: string, newParentId: string | null, newSortKey: number): Promise<void>;
  reorderFolder(id: string, newSortKey: number): Promise<void>;
  moveItem(itemId: string, newFolderId: string | null, newSortKey: number): Promise<void>;
  reorderItem(itemId: string, newSortKey: number): Promise<void>;
};

function nowSortKey(): number {
  return Date.now();
}

export function useFolders(): UseFoldersResult {
  const [folders, setFolders] = useState<SidebarFolder[]>([]);
  const [localFolderOverrides, setLocalFolderOverrides] = useState<Record<string, FolderOverride>>({});
  const [localItemOverrides, setLocalItemOverrides] = useState<Record<string, ItemOverride>>({});

  const foldersRef = useRef(folders);
  foldersRef.current = folders;

  // Keep overrides from growing unbounded: clear folder overrides once Firestore snapshot matches.
  useEffect(() => {
    if (Object.keys(localFolderOverrides).length === 0 && Object.keys(localItemOverrides).length === 0) return;

    setLocalFolderOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      let removed = 0;
      for (const [id, ov] of Object.entries(prev)) {
        const f = foldersRef.current.find((x) => x.id === id);
        if (!f) continue;
        const same =
          (ov.name === undefined || ov.name === f.name) &&
          (ov.parentId === undefined || ov.parentId === f.parentId) &&
          (ov.sortKey === undefined || ov.sortKey === f.sortKey);
        if (same) {
          delete next[id];
          removed += 1;
        }
      }
      return removed === 0 ? prev : next;
    });

    // Item overrides can't be compared against Firestore snapshots here (no lesson subscription).
    // Clear on a best-effort 2-minute timer to avoid unbounded growth.
    const timeout = window.setTimeout(() => {
      setLocalItemOverrides((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        return {};
      });
    }, 2 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [folders, localFolderOverrides, localItemOverrides]);

  const localOverrides = useMemo(
    () => ({
      folders: localFolderOverrides,
      items: localItemOverrides,
    }),
    [localFolderOverrides, localItemOverrides]
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsubFolders: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubFolders?.();
      unsubFolders = null;
      if (!user) {
        setFolders([]);
        setLocalFolderOverrides({});
        setLocalItemOverrides({});
        return;
      }
      try {
        unsubFolders = subscribeSidebarFoldersFirestore(
          (rows) => {
            setFolders(
              rows.map((r: SidebarFolderRecord) => ({
                id: r.id,
                name: r.name,
                kind: r.kind,
                language: r.language,
                parentId: r.parentId ?? null,
                sortKey: r.sortKey ?? 0,
                createdAt: r.createdAt ?? Date.now(),
                updatedAt: r.updatedAt ?? Date.now(),
              }))
            );
          },
          (error) => {
            console.error('Failed to subscribe sidebar folders', error);
          }
        );
      } catch (e) {
        console.error('Failed to subscribe sidebar folders', e);
      }
    });

    return () => {
      unsubAuth();
      unsubFolders?.();
    };
  }, []);

  const createFolder = useCallback<UseFoldersResult['createFolder']>(async (params) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ts = Date.now();
    const rec = {
      id,
      name: params.name,
      kind: params.kind as SidebarFolderKind,
      language: params.language as SidebarFolderLanguage,
      parentId: params.parentId,
      sortKey: nowSortKey(),
      createdAt: ts,
      updatedAt: ts,
    } satisfies SidebarFolderRecord;

    setLocalFolderOverrides((prev) => ({
      ...prev,
      [id]: rec,
    }));

    try {
      await createSidebarFolderFirestore(rec);
    } catch (e) {
      setLocalFolderOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      throw e;
    }
  }, []);

  const renameFolder = useCallback<UseFoldersResult['renameFolder']>(async (id, name) => {
    setLocalFolderOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), name },
    }));
    await renameSidebarFolderFirestore(id, name);
  }, []);

  const deleteFolder = useCallback<UseFoldersResult['deleteFolder']>(async (id) => {
    // Race-resistant: delete folder docs first; dangling folderIds fall back to root.
    const snapshot = foldersRef.current;
    // Delete subtree up to depth 3 (top + 2 sublevels).
    const childIds = snapshot.filter((f) => f.parentId === id).map((f) => f.id);
    const grandChildIds = snapshot
      .filter((f) => f.parentId != null && childIds.includes(f.parentId))
      .map((f) => f.id);

    setLocalFolderOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      for (const cid of childIds) delete next[cid];
      for (const gid of grandChildIds) delete next[gid];
      return next;
    });

    await deleteSidebarFolderFirestore(id);
    for (const cid of childIds) {
      await deleteSidebarFolderFirestore(cid);
    }
    for (const gid of grandChildIds) {
      await deleteSidebarFolderFirestore(gid);
    }
  }, []);

  const moveFolder = useCallback<UseFoldersResult['moveFolder']>(async (id, newParentId, newSortKey) => {
    setLocalFolderOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), parentId: newParentId, sortKey: newSortKey },
    }));
    await moveSidebarFolderFirestore(id, newParentId, newSortKey);
  }, []);

  const reorderFolder = useCallback<UseFoldersResult['reorderFolder']>(async (id, newSortKey) => {
    setLocalFolderOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), sortKey: newSortKey },
    }));
    const f = foldersRef.current.find((x) => x.id === id);
    await moveSidebarFolderFirestore(id, f?.parentId ?? null, newSortKey);
  }, []);

  const moveItem = useCallback<UseFoldersResult['moveItem']>(async (itemId, newFolderId, newSortKey) => {
    setLocalItemOverrides((prev) => ({
      ...prev,
      [itemId]: { folderId: newFolderId, sortKey: newSortKey },
    }));
    try {
      await patchLessonSidebarPlacementFirestore(itemId, { folderId: newFolderId, sortKey: newSortKey });
    } catch (e) {
      setLocalItemOverrides((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      throw e;
    }
  }, []);

  const reorderItem = useCallback<UseFoldersResult['reorderItem']>(async (itemId, newSortKey) => {
    // Reorder is just a move within the same container; callers should prefer moveItem with folderId.
    // This helper assumes the item already has an override (e.g. was previously moved) or the caller
    // will call moveItem directly instead.
    const ov = localItemOverrides[itemId];
    if (!ov) return;
    setLocalItemOverrides((prev) => ({
      ...prev,
      [itemId]: { ...ov, sortKey: newSortKey },
    }));
    await patchLessonSidebarPlacementFirestore(itemId, { folderId: ov.folderId, sortKey: newSortKey });
  }, [localItemOverrides]);

  return {
    folders,
    localOverrides,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    reorderFolder,
    moveItem,
    reorderItem,
  };
}
