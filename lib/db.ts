import { openDB, DBSchema, IDBPDatabase, type IDBPTransaction } from 'idb';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseFirestore, getFirebaseStorage } from '@/lib/auth/firebase-client';

export interface FlashcardData {
  lines: string[];
  ratings: Record<number, 'again' | 'good' | 'done'>;
  currentIndex: number;
  isShuffled: boolean;
  shuffledIndices: number[];
  /** After "Deck complete" → Keep, suppresses the cleanup modal until progress is reset. */
  completionModalShown?: boolean;
}

/** Full lesson row stored in IndexedDB (includes File blob when present). */
export interface LessonRecord {
  id: string;
  type?: 'audio' | 'flashcard';
  name: string;
  language: string;
  /**
   * Sidebar folder membership (optional). Null/undefined means "root".
   * Persisted to Firestore and used only for sidebar organization.
   */
  folderId?: string | null;
  /**
   * Sidebar sort key for manual ordering within a container (folder/root).
   * Client-side ordering only (do not use as Firestore orderBy).
   */
  sortKey?: number;
  /** Lesson media blob (audio or video). */
  mediaFile?: File | null;
  /** Remote Firebase Storage path for uploaded lesson media (Phase 1+). */
  mediaPath?: string | null;
  /** Public download URL for Firebase Storage media (Phase 1+). */
  mediaUrl?: string | null;
  /** Original client-side filename for uploaded media. */
  mediaFileName?: string | null;
  /** MIME type persisted for media rehydration and playback logic. */
  mediaMimeType?: string | null;
  /** Optional size metadata for migration/debugging support. */
  mediaSizeBytes?: number | null;
  /** Audio vs video lesson; flashcard rows omit or use 'audio' as unused. */
  mediaType?: 'audio' | 'video';
  transcriptText: string;
  completedSentences: Record<number, boolean>;
  /** Dictation mode drafts (sentence id → input); optional for older documents. */
  dictationInputs?: Record<number, string>;
  totalSentences: number;
  createdAt: number;
  lastAccessed: number;
  /** Bumped only on substantive edits (not lastAccessed). */
  updatedAt: number;
  isTrashed?: boolean;
  trashedAt?: number;
  flashcardData?: FlashcardData;
}

/** Firestore-safe lesson document shape (excludes in-browser File blobs). */
export type FirestoreLessonRecord = Omit<LessonRecord, 'mediaFile'> & {
  mediaPath?: string | null;
  mediaUrl?: string | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: number | null;
};

export interface UploadedLessonMedia {
  path: string;
  downloadURL: string;
  contentType: string | null;
  size: number;
}

const getCurrentUidOrThrow = (): string => {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('Authenticated Firebase user is required');
  }
  return uid;
};

export const getUserLessonsCollectionPath = (uid: string): string => `users/${uid}/lessons`;
export const getUserMediaCollectionPath = (uid: string): string => `users/${uid}/media`;
export const getUserSidebarFoldersCollectionPath = (uid: string): string => `users/${uid}/sidebarFolders`;

const getLessonDocRef = (uid: string, lessonId: string) =>
  doc(getFirebaseFirestore(), getUserLessonsCollectionPath(uid), lessonId);

const getSidebarFolderDocRef = (uid: string, folderId: string) =>
  doc(getFirebaseFirestore(), getUserSidebarFoldersCollectionPath(uid), folderId);

/** Firestore rejects `undefined` anywhere in document data (e.g. `trashedAt: undefined`). */
function stripUndefinedForFirestore<T>(input: T): T {
  if (input === null || typeof input !== 'object') return input;
  if (input instanceof Date) return input;
  if (Array.isArray(input)) {
    return input.map((x) => stripUndefinedForFirestore(x)) as T;
  }
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedForFirestore(v);
  }
  return out as T;
}

const toFirestoreLessonRecord = (lesson: LessonRecord): FirestoreLessonRecord => {
  const { mediaFile: _mediaFile, ...lessonWithoutBlob } = lesson;
  return stripUndefinedForFirestore(lessonWithoutBlob) as FirestoreLessonRecord;
};

const fromFirestoreLessonRecord = (
  lessonId: string,
  data: Partial<FirestoreLessonRecord>
): LessonRecord => {
  return {
    id: data.id ?? lessonId,
    type: data.type ?? 'audio',
    name: data.name ?? '',
    language: data.language ?? '',
    folderId: data.folderId ?? null,
    sortKey: data.sortKey,
    mediaFile: null,
    mediaPath: data.mediaPath ?? null,
    mediaUrl: data.mediaUrl ?? null,
    mediaFileName: data.mediaFileName ?? null,
    mediaMimeType: data.mediaMimeType ?? null,
    mediaSizeBytes: data.mediaSizeBytes ?? null,
    mediaType: data.mediaType ?? 'audio',
    transcriptText: data.transcriptText ?? '',
    completedSentences: data.completedSentences ?? {},
    dictationInputs: data.dictationInputs ?? {},
    totalSentences: data.totalSentences ?? 0,
    createdAt: data.createdAt ?? Date.now(),
    lastAccessed: data.lastAccessed ?? Date.now(),
    updatedAt: data.updatedAt ?? Date.now(),
    isTrashed: data.isTrashed ?? false,
    trashedAt: data.trashedAt,
    flashcardData: data.flashcardData,
  };
};

export type SidebarFolderKind = 'audio' | 'flashcard';
export type SidebarFolderLanguage = 'en' | 'de';

export interface SidebarFolderRecord {
  id: string;
  name: string;
  kind: SidebarFolderKind;
  language: SidebarFolderLanguage;
  parentId: string | null;
  sortKey: number;
  createdAt: number;
  updatedAt: number;
}

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
};

/**
 * Upload lesson media to Firebase Storage under users/{uid}/media.
 * Returns remote path + public download URL for Firestore persistence.
 */
export const uploadLessonMediaToFirebase = async (
  lessonId: string,
  file: File
): Promise<UploadedLessonMedia> => {
  const uid = getCurrentUidOrThrow();
  const safeName = sanitizeFileName(file.name || 'media.bin');
  const objectPath = `${getUserMediaCollectionPath(uid)}/${lessonId}-${Date.now()}-${safeName}`;
  const objectRef = ref(getFirebaseStorage(), objectPath);
  const snapshot = await uploadBytes(objectRef, file, {
    contentType: file.type || undefined,
  });
  const downloadURL = await getDownloadURL(snapshot.ref);
  return {
    path: objectPath,
    downloadURL,
    contentType: snapshot.metadata.contentType ?? file.type ?? null,
    size: snapshot.metadata.size ?? file.size,
  };
};

/** Firebase-first CRUD API (Phase 1) */
export const saveLessonFirestore = async (lesson: LessonRecord): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  const payload = toFirestoreLessonRecord(lesson);
  await setDoc(getLessonDocRef(uid, lesson.id), payload);
};

/**
 * Patch only `flashcardData.completionModalShown` (plus `updatedAt`).
 * Prefer this over read + saveLessonFirestore after deck completion: a full setDoc from a stale
 * read can race with the async last-card rating persist and drop the final "done" in Firestore.
 */
export const patchFlashcardCompletionModalShownFirestore = async (
  lessonId: string,
  completionModalShown: boolean
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, lessonId), {
    'flashcardData.completionModalShown': completionModalShown,
    updatedAt: Date.now(),
  });
};

/** Patch a single flashcard rating without rewriting the whole lesson (avoids setDoc races). */
export const patchFlashcardRatingFirestore = async (
  lessonId: string,
  lineIndex: number,
  rating: 'again' | 'good' | 'done'
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, lessonId), {
    [`flashcardData.ratings.${lineIndex}`]: rating,
    updatedAt: Date.now(),
  });
};

export const getLessonFirestore = async (id: string): Promise<LessonRecord | null> => {
  const uid = getCurrentUidOrThrow();
  const snapshot = await getDoc(getLessonDocRef(uid, id));
  if (!snapshot.exists()) return null;
  return fromFirestoreLessonRecord(snapshot.id, snapshot.data() as FirestoreLessonRecord);
};

export const getAllLessonsFirestore = async (): Promise<LessonRecord[]> => {
  const uid = getCurrentUidOrThrow();
  const lessonsQuery = query(
    collection(getFirebaseFirestore(), getUserLessonsCollectionPath(uid)),
    orderBy('lastAccessed', 'desc')
  );
  const snapshots = await getDocs(lessonsQuery);
  return snapshots.docs.map((item) =>
    fromFirestoreLessonRecord(item.id, item.data() as FirestoreLessonRecord)
  );
};

export const subscribeLessonsFirestore = (
  onData: (lessons: LessonRecord[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const uid = getCurrentUidOrThrow();
  const lessonsQuery = query(
    collection(getFirebaseFirestore(), getUserLessonsCollectionPath(uid)),
    orderBy('lastAccessed', 'desc')
  );
  return onSnapshot(
    lessonsQuery,
    (snapshots) => {
      const next = snapshots.docs.map((item) =>
        fromFirestoreLessonRecord(item.id, item.data() as FirestoreLessonRecord)
      );
      onData(next);
    },
    (error) => {
      onError?.(error);
    }
  );
};

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

export const patchLessonSidebarPlacementFirestore = async (
  lessonId: string,
  patch: { folderId: string | null; sortKey: number }
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, lessonId), {
    folderId: patch.folderId,
    sortKey: patch.sortKey,
    updatedAt: Date.now(),
  });
};

export const subscribeLessonFirestore = (
  id: string,
  onData: (lesson: LessonRecord | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const uid = getCurrentUidOrThrow();
  return onSnapshot(
    getLessonDocRef(uid, id),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(fromFirestoreLessonRecord(snapshot.id, snapshot.data() as FirestoreLessonRecord));
    },
    (error) => {
      onError?.(error);
    }
  );
};

export const deleteLessonFirestore = async (id: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await deleteDoc(getLessonDocRef(uid, id));
};

export const updateLessonProgressFirestore = async (
  id: string,
  completedSentences: Record<number, boolean>,
  options?: { dictationInputs?: Record<number, string> }
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  const patch: Record<string, unknown> = {
    completedSentences,
    lastAccessed: Date.now(),
    updatedAt: Date.now(),
  };
  if (options?.dictationInputs !== undefined) {
    patch.dictationInputs = options.dictationInputs;
  }
  await updateDoc(getLessonDocRef(uid, id), patch);
};

export const trashLessonFirestore = async (id: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, id), {
    isTrashed: true,
    trashedAt: Date.now(),
    updatedAt: Date.now(),
  });
};

export const restoreLessonFirestore = async (id: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, id), {
    isTrashed: false,
    trashedAt: null,
    updatedAt: Date.now(),
  });
};

export const renameLessonFirestore = async (id: string, name: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, id), {
    name,
    updatedAt: Date.now(),
  });
};

export const updateLessonLanguageFirestore = async (
  id: string,
  language: string
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, id), {
    language,
    updatedAt: Date.now(),
  });
};

export const touchLessonAccessedFirestore = async (id: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, id), {
    lastAccessed: Date.now(),
  });
};

/**
 * Legacy IndexedDB schema/API retained for migration fallback only.
 * New product writes should move to Firestore helpers above.
 */
export interface LessonDB extends DBSchema {
  lessons: {
    key: string;
    value: LessonRecord;
    indexes: { 'by-language': string; 'by-accessed': number };
  };
}

let dbPromise: Promise<IDBPDatabase<LessonDB>>;

export const bumpLessonUpdatedAt = (lesson: LessonRecord) => {
  lesson.updatedAt = Date.now();
};

async function migrateV3(
  transaction: IDBPTransaction<LessonDB, ('lessons')[], 'versionchange'>
): Promise<void> {
  const store = transaction.objectStore('lessons');
  let cursor = await store.openCursor();
  while (cursor) {
    const raw = cursor.value as Record<string, unknown> & Partial<LessonRecord>;
    delete raw.ipaData;
    const lesson = raw as unknown as LessonRecord;
    if (lesson.isTrashed && lesson.trashedAt == null) {
      lesson.trashedAt = lesson.lastAccessed ?? Date.now();
    }
    if (typeof lesson.updatedAt !== 'number') {
      lesson.updatedAt = lesson.lastAccessed ?? lesson.createdAt ?? Date.now();
    }
    await cursor.update(lesson);
    cursor = await cursor.continue();
  }
}

/** v3 → v4: audioFile → mediaFile; default mediaType 'audio'. */
async function migrateV4(
  transaction: IDBPTransaction<LessonDB, ('lessons')[], 'versionchange'>
): Promise<void> {
  const store = transaction.objectStore('lessons');
  let cursor = await store.openCursor();
  while (cursor) {
    const raw = cursor.value as unknown as Record<string, unknown>;
    const legacy = raw.audioFile;
    if (legacy !== undefined && legacy !== null) {
      raw.mediaFile = legacy;
      delete raw.audioFile;
    } else if (legacy === null) {
      raw.mediaFile = null;
      delete raw.audioFile;
    }
    if (raw.mediaType == null || raw.mediaType === '') {
      raw.mediaType = 'audio';
    }
    await cursor.update(raw as unknown as LessonRecord);
    cursor = await cursor.continue();
  }
}

export const initDB = () => {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<LessonDB>('shadowing-app-db', 4, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('lessons', { keyPath: 'id' });
          store.createIndex('by-language', 'language');
          store.createIndex('by-accessed', 'lastAccessed');
        }
        if (oldVersion < 3) {
          await migrateV3(transaction);
        }
        if (oldVersion < 4) {
          await migrateV4(transaction);
        }
      },
    });
  }
  return dbPromise;
};

/** Legacy IndexedDB write path (migration-only). */
export const saveLesson = async (lesson: LessonRecord) => {
  const db = await initDB();
  if (db) await db.put('lessons', lesson);
};

/** Legacy IndexedDB read path (migration-only). */
export const getLesson = async (id: string) => {
  const db = await initDB();
  if (db) return db.get('lessons', id);
  return null;
};

/** Legacy IndexedDB list path (migration-only). */
export const getAllLessons = async (): Promise<LessonRecord[]> => {
  const db = await initDB();
  if (db) return db.getAllFromIndex('lessons', 'by-accessed');
  return [];
};

export const deleteLesson = async (id: string) => {
  const db = await initDB();
  if (!db) throw new Error('Database not available');
  await db.delete('lessons', id);
};

export const trashLesson = async (id: string) => {
  const db = await initDB();
  if (!db) return;
  const lesson = await db.get('lessons', id);
  if (lesson) {
    lesson.isTrashed = true;
    lesson.trashedAt = Date.now();
    bumpLessonUpdatedAt(lesson);
    await db.put('lessons', lesson);
  }
};

export const restoreLesson = async (id: string) => {
  const db = await initDB();
  if (!db) return;
  const lesson = await db.get('lessons', id);
  if (lesson) {
    lesson.isTrashed = false;
    delete lesson.trashedAt;
    lesson.updatedAt = Date.now();
    await db.put('lessons', lesson);
  }
};

/** Remove media file only; keep transcript, progress, and lesson in library (not trashed). */
export const clearLessonMedia = async (id: string) => {
  const db = await initDB();
  if (!db) throw new Error('Database not available');
  const lesson = await db.get('lessons', id);
  if (!lesson || lesson.type === 'flashcard') {
    throw new Error('Lesson not found or cannot clear media for this item');
  }
  lesson.mediaFile = null;
  lesson.type = 'audio';
  lesson.mediaType = 'audio';
  lesson.isTrashed = false;
  bumpLessonUpdatedAt(lesson);
  await db.put('lessons', lesson);
};

export const updateLessonProgress = async (id: string, completedSentences: Record<number, boolean>) => {
  const db = await initDB();
  if (!db) return;
  const lesson = await db.get('lessons', id);
  if (lesson) {
    lesson.completedSentences = completedSentences;
    lesson.lastAccessed = Date.now();
    bumpLessonUpdatedAt(lesson);
    await db.put('lessons', lesson);
  }
};
