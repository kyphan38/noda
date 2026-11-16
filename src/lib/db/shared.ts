// Firestore refs, paths and record converters shared by the db modules.
import { doc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/auth/firebase-client';
import { LESSON_CONTENT_DOC_ID } from '@/lib/lessonLayout';
import type { LessonRecord, FirestoreLessonRecord } from './types';

/** Full lesson row stored in IndexedDB (includes File blob when present). */
export const getCurrentUidOrThrow = (): string => {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('Authenticated Firebase user is required');
  }
  return uid;
};

export const getUserLessonsCollectionPath = (uid: string): string => `users/${uid}/lessons`;
export const getUserMediaCollectionPath = (uid: string): string => `users/${uid}/media`;
export const getUserSidebarFoldersCollectionPath = (uid: string): string => `users/${uid}/sidebarFolders`;

export const getLessonDocRef = (uid: string, lessonId: string) =>
  doc(getFirebaseFirestore(), getUserLessonsCollectionPath(uid), lessonId);

/** Heavy half of a lesson (transcript, drafts, progress maps); see lib/lessonLayout.ts. */
export const getLessonContentDocRef = (uid: string, lessonId: string) =>
  doc(getFirebaseFirestore(), getUserLessonsCollectionPath(uid), lessonId, 'content', LESSON_CONTENT_DOC_ID);

export const getSidebarFolderDocRef = (uid: string, folderId: string) =>
  doc(getFirebaseFirestore(), getUserSidebarFoldersCollectionPath(uid), folderId);

/** Path to the cached shadowing-pattern analysis doc (written only by the Cloud Function). */
export const getShadowingAnalysisDocPath = (
  uid: string,
  lessonId: string,
  sentenceId: number
): string => `${getUserLessonsCollectionPath(uid)}/${lessonId}/shadowingAnalysis/${sentenceId}`;

export const getShadowingAnalysisDocRef = (uid: string, lessonId: string, sentenceId: number) =>
  doc(
    getFirebaseFirestore(),
    getUserLessonsCollectionPath(uid),
    lessonId,
    'shadowingAnalysis',
    String(sentenceId)
  );

/** Firestore rejects `undefined` anywhere in document data (e.g. `trashedAt: undefined`). */
export function stripUndefinedForFirestore<T>(input: T): T {
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

export const toFirestoreLessonRecord = (lesson: LessonRecord): FirestoreLessonRecord => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mediaFile: _mediaFile, ...lessonWithoutBlob } = lesson;
  return stripUndefinedForFirestore(lessonWithoutBlob) as FirestoreLessonRecord;
};

export const fromFirestoreLessonRecord = (
  lessonId: string,
  data: Partial<FirestoreLessonRecord>
): LessonRecord => {
  return {
    id: data.id ?? lessonId,
    type: 'audio',
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
    source: data.source ?? 'upload',
    youtubeVideoId: data.youtubeVideoId ?? null,
    transcriptText: data.transcriptText ?? '',
    completedSentences: data.completedSentences ?? {},
    dictationInputs: data.dictationInputs ?? {},
    progress: data.progress ?? {},
    lastMode: data.lastMode,
    totalSentences: data.totalSentences ?? 0,
    createdAt: data.createdAt ?? Date.now(),
    lastAccessed: data.lastAccessed ?? Date.now(),
    updatedAt: data.updatedAt ?? Date.now(),
    isTrashed: data.isTrashed ?? false,
    trashedAt: data.trashedAt,
    dictationDone: data.dictationDone,
    shadowingDone: data.shadowingDone,
  };
};

/**
 * Last done-counts written to each lesson doc, so frequent progress saves (every
 * 200ms while typing) only touch the small lesson doc - which every lessons snapshot
 * resends - when a count actually changes.
 */
export const writtenCounts = new Map<string, { dictation?: number; shadowing?: number }>();
