import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface LessonDB extends DBSchema {
  lessons: {
    key: string;
    value: {
      id: string;
      name: string;
      language: string;
      audioFile?: File | null;
      transcriptText: string;
      ipaData: Record<number, string>;
      completedSentences: Record<number, boolean>;
      totalSentences: number;
      createdAt: number;
      lastAccessed: number;
      isTrashed?: boolean;
    };
    indexes: { 'by-language': string, 'by-accessed': number };
  };
}

let dbPromise: Promise<IDBPDatabase<LessonDB>>;

export const initDB = () => {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<LessonDB>('shadowing-app-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('lessons', { keyPath: 'id' });
        store.createIndex('by-language', 'language');
        store.createIndex('by-accessed', 'lastAccessed');
      },
    });
  }
  return dbPromise;
};

export const saveLesson = async (lesson: any) => {
  const db = await initDB();
  if (db) await db.put('lessons', lesson);
};

export const getLesson = async (id: string) => {
  const db = await initDB();
  if (db) return db.get('lessons', id);
  return null;
};

export const getAllLessons = async () => {
  const db = await initDB();
  if (db) return db.getAllFromIndex('lessons', 'by-accessed');
  return [];
};

export const deleteLesson = async (id: string) => {
  const db = await initDB();
  if (db) await db.delete('lessons', id);
};

export const trashLesson = async (id: string) => {
  const db = await initDB();
  if (db) {
    const lesson = await db.get('lessons', id);
    if (lesson) {
      lesson.audioFile = null;
      lesson.isTrashed = true;
      await db.put('lessons', lesson);
    }
  }
};

export const updateLessonProgress = async (id: string, completedSentences: Record<number, boolean>, ipaData: Record<number, string>) => {
  const db = await initDB();
  if (db) {
    const lesson = await db.get('lessons', id);
    if (lesson) {
      lesson.completedSentences = completedSentences;
      lesson.ipaData = ipaData;
      lesson.lastAccessed = Date.now();
      await db.put('lessons', lesson);
    }
  }
};
