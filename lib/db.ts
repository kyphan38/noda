import { openDB, DBSchema, IDBPDatabase, type IDBPTransaction } from 'idb';

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

export const saveLesson = async (lesson: LessonRecord) => {
  const db = await initDB();
  if (db) await db.put('lessons', lesson);
};

export const getLesson = async (id: string) => {
  const db = await initDB();
  if (db) return db.get('lessons', id);
  return null;
};

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
