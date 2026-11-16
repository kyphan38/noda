import type { AppMode, Sentence } from '@/types';
import { findActiveTranscriptIndex } from '@/lib/transcript-scroll';

/**
 * Per-mode progress stored on the lesson doc as `progress`, next to `lastMode`.
 *
 * Dictation completion is NOT in here: it stays in the lesson's top-level
 * `completedSentences`, which predates per-mode progress. Keeping it there means
 * no data migration and older builds still read dictation progress correctly.
 */
export interface LessonProgressRecord {
  dictation?: { lastIndex?: number; updatedAt?: number };
  shadowing?: { completed?: Record<number, boolean>; lastIndex?: number; updatedAt?: number };
  listen?: { lastTime?: number; updatedAt?: number };
}

/** 0-100 share of `total` sentences marked done. */
export function completionPercent(completed: Record<number, boolean> | undefined, total: number): number {
  if (!completed || total <= 0) return 0;
  const done = Object.values(completed).filter(Boolean).length;
  return Math.min(100, Math.round((done / total) * 100));
}

/** Where "Continue" takes the learner: a mode plus a sentence index (and a time for listen). */
export interface ResumeTarget {
  mode: AppMode;
  /** Sentence to jump to (0-based). For listen, the sentence playing at `time`. */
  index: number;
  /** Media time to seek to. */
  time: number;
}

/** Ignore listen positions this close to the start or end - nothing worth resuming. */
const LISTEN_EDGE_SECONDS = 5;

/**
 * The spot to offer as "Continue" when a lesson opens, or null when the learner
 * has not really started the mode they used last (or already finished it).
 *
 * - dictation: the first sentence not typed yet - the same row dictation scrolls to.
 * - shadowing: the sentence they were on (`lastIndex`), else the first not shadowed.
 * - listen: the saved playback time.
 */
export function findResumeTarget(
  lastMode: AppMode | undefined,
  progress: LessonProgressRecord | undefined,
  dictationCompleted: Record<number, boolean>,
  transcript: Sentence[]
): ResumeTarget | null {
  if (!lastMode || transcript.length === 0) return null;

  if (lastMode === 'dictation') {
    const index = transcript.findIndex((s) => !dictationCompleted[s.id]);
    if (index <= 0) return null;
    return { mode: 'dictation', index, time: transcript[index].start };
  }

  if (lastMode === 'shadowing') {
    const done = progress?.shadowing?.completed ?? {};
    const saved = progress?.shadowing?.lastIndex;
    const firstOpen = transcript.findIndex((s) => !done[s.id]);
    if (firstOpen === -1) return null;
    const index =
      typeof saved === 'number' && saved >= 0 && saved < transcript.length ? saved : firstOpen;
    if (index <= 0) return null;
    return { mode: 'shadowing', index, time: transcript[index].start };
  }

  const time = progress?.listen?.lastTime;
  const lessonEnd = transcript[transcript.length - 1].end;
  if (typeof time !== 'number' || time < LISTEN_EDGE_SECONDS || time > lessonEnd - LISTEN_EDGE_SECONDS) {
    return null;
  }
  // Never -1 for a non-empty transcript: in a gap it returns the next sentence.
  return { mode: 'listen', index: findActiveTranscriptIndex(time, transcript), time };
}
