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
  ratings: Record<number, 'again' | 'hard' | 'good' | 'easy' | 'done'>;
  currentIndex: number;
  isShuffled: boolean;
  shuffledIndices: number[];
}

/** Full lesson row stored in IndexedDB (includes File blob when present). */
export interface LessonRecord {
  id: string;
  type?: 'audio' | 'flashcard';
  name: string;
  language: string;
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

const getLessonDocRef = (uid: string, lessonId: string) =>
  doc(getFirebaseFirestore(), getUserLessonsCollectionPath(uid), lessonId);

const toFirestoreLessonRecord = (lesson: LessonRecord): FirestoreLessonRecord => {
  const { mediaFile: _mediaFile, ...lessonWithoutBlob } = lesson;
  return lessonWithoutBlob;
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
    mediaFile: null,
    mediaPath: data.mediaPath ?? null,
    mediaUrl: data.mediaUrl ?? null,
    mediaFileName: data.mediaFileName ?? null,
    mediaMimeType: data.mediaMimeType ?? null,
    mediaSizeBytes: data.mediaSizeBytes ?? null,
    mediaType: data.mediaType ?? 'audio',
    transcriptText: data.transcriptText ?? '',
    completedSentences: data.completedSentences ?? {},
    totalSentences: data.totalSentences ?? 0,
    createdAt: data.createdAt ?? Date.now(),
    lastAccessed: data.lastAccessed ?? Date.now(),
    updatedAt: data.updatedAt ?? Date.now(),
    isTrashed: data.isTrashed ?? false,
    trashedAt: data.trashedAt,
    flashcardData: data.flashcardData,
  };
};

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
  completedSentences: Record<number, boolean>
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await updateDoc(getLessonDocRef(uid, id), {
    completedSentences,
    lastAccessed: Date.now(),
    updatedAt: Date.now(),
  });
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
