// Lessons in Firestore: save, read, subscribe, progress, trash.
import {
  collection,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import { type AppMode } from '@/types';
import { countDone, mergeLesson, splitLesson } from '@/lib/lessonLayout';
import {
  getCurrentUidOrThrow,
  getUserLessonsCollectionPath,
  getLessonDocRef,
  getLessonContentDocRef,
  toFirestoreLessonRecord,
  fromFirestoreLessonRecord,
  writtenCounts,
} from './shared';
import type { LessonRecord, FirestoreLessonRecord } from './types';

export const saveLessonFirestore = async (lesson: LessonRecord): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  const { meta, content } = splitLesson(toFirestoreLessonRecord(lesson) as unknown as Record<string, unknown>);
  const batch = writeBatch(getFirebaseFirestore());
  batch.set(getLessonDocRef(uid, lesson.id), meta);
  batch.set(getLessonContentDocRef(uid, lesson.id), content);
  await batch.commit();
  writtenCounts.set(lesson.id, {
    dictation: meta.dictationDone as number,
    shadowing: meta.shadowingDone as number,
  });
};

/** Reads both halves of a lesson and joins them. */
export const getLessonFirestore = async (id: string): Promise<LessonRecord | null> => {
  const uid = getCurrentUidOrThrow();
  const [lessonSnap, contentSnap] = await Promise.all([
    getDoc(getLessonDocRef(uid, id)),
    getDoc(getLessonContentDocRef(uid, id)),
  ]);
  if (!lessonSnap.exists()) return null;
  const merged = mergeLesson(lessonSnap.data(), contentSnap.exists() ? contentSnap.data() : undefined);
  const lesson = fromFirestoreLessonRecord(lessonSnap.id, merged as Partial<FirestoreLessonRecord>);
  writtenCounts.set(id, { dictation: lesson.dictationDone, shadowing: lesson.shadowingDone });
  return lesson;
};

/**
 * Reads the cached shadowing-pattern analysis for one sentence directly via the client SDK
 * (cache-only; call `requestShadowingAnalysis` in `@/lib/shadowingAnalysis` to trigger analysis).
 * Returns null on cache miss.
 */

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

export const deleteLessonFirestore = async (id: string): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  await deleteDoc(getLessonDocRef(uid, id));
};

/**
 * Dictation progress (and drafts) go to `content/main`; the lesson doc only gets the
 * new `dictationDone` count, and only when it changed.
 */
export const updateLessonProgressFirestore = async (
  id: string,
  completedSentences: Record<number, boolean>,
  options?: { dictationInputs?: Record<number, string> }
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  const batch = writeBatch(getFirebaseFirestore());
  const content: Record<string, unknown> = { completedSentences };
  const fields = ['completedSentences'];
  if (options?.dictationInputs !== undefined) {
    content.dictationInputs = options.dictationInputs;
    fields.push('dictationInputs');
  }
  // mergeFields replaces these maps whole, so cleared sentences really go away.
  batch.set(getLessonContentDocRef(uid, id), content, { mergeFields: fields });
  const count = countDone(completedSentences);
  const known = writtenCounts.get(id) ?? {};
  if (known.dictation !== count) {
    const now = Date.now();
    batch.update(getLessonDocRef(uid, id), { dictationDone: count, lastAccessed: now, updatedAt: now });
  }
  await batch.commit();
  writtenCounts.set(id, { ...known, dictation: count });
};

/** Shadowing progress to `content/main`; `shadowingDone` on the lesson doc when it changed. */
export const updateShadowingProgressFirestore = async (
  id: string,
  completed: Record<number, boolean>
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  const now = Date.now();
  const batch = writeBatch(getFirebaseFirestore());
  batch.set(
    getLessonContentDocRef(uid, id),
    { progress: { shadowing: { completed, updatedAt: now } } },
    { mergeFields: ['progress.shadowing.completed', 'progress.shadowing.updatedAt'] }
  );
  const count = countDone(completed);
  const known = writtenCounts.get(id) ?? {};
  if (known.shadowing !== count) {
    batch.update(getLessonDocRef(uid, id), { shadowingDone: count, lastAccessed: now, updatedAt: now });
  }
  await batch.commit();
  writtenCounts.set(id, { ...known, shadowing: count });
};

/**
 * Remembers where the learner is in `mode` (a sentence index, or a playback time for
 * listen) and makes `mode` the lesson's last-used tab. Runs every few seconds while
 * playing, so it writes only the content doc - neither `updatedAt` (not a substantive
 * edit) nor `lastAccessed` (set when the lesson opens) on the lesson doc.
 */
export const saveResumePositionFirestore = async (
  id: string,
  mode: AppMode,
  position: { lastIndex: number } | { lastTime: number }
): Promise<void> => {
  const uid = getCurrentUidOrThrow();
  const now = Date.now();
  const key = 'lastIndex' in position ? 'lastIndex' : 'lastTime';
  const value = 'lastIndex' in position ? position.lastIndex : position.lastTime;
  // Content doc only: this runs every few seconds while playing and must not resend
  // the lesson doc to every lessons listener.
  await setDoc(
    getLessonContentDocRef(uid, id),
    { lastMode: mode, progress: { [mode]: { [key]: value, updatedAt: now } } },
    { mergeFields: ['lastMode', `progress.${mode}.${key}`, `progress.${mode}.updatedAt`] }
  );
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
