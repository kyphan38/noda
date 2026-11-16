// Sidebar folders in Firestore.
import {
  collection,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import {
  getCurrentUidOrThrow,
  getUserSidebarFoldersCollectionPath,
  getSidebarFolderDocRef,
  stripUndefinedForFirestore,
} from './shared';
import type { SidebarFolderRecord } from './types';

export const subscribeSidebarFoldersFirestore = (
  onData: (folders: SidebarFolderRecord[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const uid = getCurrentUidOrThrow();
  const foldersQuery = query(
    collection(getFirebaseFirestore(), getUserSidebarFoldersCollectionPath(uid)),
    orderBy('sortKey', 'asc')
  );
  return onSnapshot(
    foldersQuery,
    (snapshots) => {
      const next = snapshots.docs.map((d) => d.data() as SidebarFolderRecord);
      onData(next);
    },
    (error) => onError?.(error)
  );
};

export const createSidebarFolderFirestore = async (
  folder: SidebarFolderRecord
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await setDoc(getSidebarFolderDocRef(uid, folder.id), stripUndefinedForFirestore(folder));
};

export const renameSidebarFolderFirestore = async (id: string, name: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getSidebarFolderDocRef(uid, id), {
    name,
    updatedAt: Date.now(),
  });
};

export const moveSidebarFolderFirestore = async (
  id: string,
  parentId: string | null,
  sortKey: number
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getSidebarFolderDocRef(uid, id), {
    parentId,
    sortKey,
    updatedAt: Date.now(),
  });
};

export const deleteSidebarFolderFirestore = async (id: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await deleteDoc(getSidebarFolderDocRef(uid, id));
};
