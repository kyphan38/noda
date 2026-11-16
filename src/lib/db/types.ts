// Record types stored in Firestore and IndexedDB.
import { type AppMode, type LessonSource } from '@/types';
import type { LessonProgressRecord } from '@/lib/progress';

export interface LessonRecord {
  id: string;
  /** Always 'audio' (flashcard decks were removed on 2026-10-01). */
  type?: 'audio';
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
  /** Audio vs video lesson. */
  mediaType?: 'audio' | 'video';
  /** Missing on lessons saved before YouTube lessons existed: those are uploads. */
  source?: LessonSource;
  /** Set when `source` is 'youtube'; such lessons have no media in Storage. */
  youtubeVideoId?: string | null;
  transcriptText: string;
  completedSentences: Record<number, boolean>;
  /** Dictation mode drafts (sentence id → input); optional for older documents. */
  dictationInputs?: Record<number, string>;
  /** Shadowing progress and per-mode resume positions; see lib/progress.ts. */
  progress?: LessonProgressRecord;
  /** Tab the learner used last, for the "Continue" prompt. */
  lastMode?: AppMode;
  totalSentences: number;
  createdAt: number;
  lastAccessed: number;
  /** Bumped only on substantive edits (not lastAccessed). */
  updatedAt: number;
  isTrashed?: boolean;
  trashedAt?: number;
  /** Sentences done per mode, kept on the small lesson doc for the sidebar (see lib/lessonLayout.ts). */
  dictationDone?: number;
  shadowingDone?: number;
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


export type SidebarFolderKind = 'audio';
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
