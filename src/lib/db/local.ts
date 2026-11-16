// Old IndexedDB store (local copies, export).
import { openDB, DBSchema, IDBPDatabase, type IDBPTransaction } from 'idb';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import { LESSON_SUBCOLLECTIONS, type ExportInput } from '../exportData';
import {
  getCurrentUidOrThrow,
  getUserLessonsCollectionPath,
  getUserSidebarFoldersCollectionPath,
} from './shared';
import type { LessonRecord } from './types';

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
  if (!lesson) {
    throw new Error('Lesson not found');
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

/** Reads every lesson (with sub-documents) and folder once, for the JSON export. */
export const readAllForExport = async (): Promise<ExportInput> => {
  const uid = getCurrentUidOrThrow();
  const db = getFirebaseFirestore();
  const lessonsSnap = await getDocs(collection(db, getUserLessonsCollectionPath(uid)));
  const lessons = await Promise.all(
    lessonsSnap.docs.map(async (d) => {
      const subs = await Promise.all(
        LESSON_SUBCOLLECTIONS.map(async (name) => {
          const snap = await getDocs(collection(db, getUserLessonsCollectionPath(uid), d.id, name));
          return snap.docs.map((s) => ({ id: s.id, ...s.data() }));
        })
      );
      const [content, shadowingAnalysis, speakingAttempts] = subs;
      return { id: d.id, ...d.data(), content, shadowingAnalysis, speakingAttempts };
    })
  );
  const foldersSnap = await getDocs(collection(db, getUserSidebarFoldersCollectionPath(uid)));
  return { lessons, sidebarFolders: foldersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
};
