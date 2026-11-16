/**
 * How a lesson is split across Firestore documents.
 *
 * - `users/{uid}/lessons/{id}`: small metadata the sidebar listens to (name, folder,
 *   media, counts of sentences done). Every lessons snapshot sends these docs, so they
 *   must stay small.
 * - `users/{uid}/lessons/{id}/content/main`: everything heavy (transcript, dictation
 *   drafts, per-sentence progress, resume positions), read only when a lesson opens.
 *
 * Before 2026-10-01 everything lived in the lesson doc. Readers still accept that:
 * a lesson without a content doc reads its heavy fields from the lesson doc itself.
 */

/** Fields stored in `content/main` instead of the lesson doc. */
export const LESSON_CONTENT_FIELDS = [
  'transcriptText',
  'completedSentences',
  'dictationInputs',
  'progress',
  'lastMode',
] as const;

export const LESSON_CONTENT_DOC_ID = 'main';

type ContentField = (typeof LESSON_CONTENT_FIELDS)[number];

/** Number of entries marked done in a per-sentence map. */
export function countDone(map: Record<number, boolean> | undefined | null): number {
  if (!map) return 0;
  return Object.values(map).filter(Boolean).length;
}

/**
 * Splits a full lesson into the two documents. The metadata half gets the
 * `dictationDone` / `shadowingDone` counts the sidebar shows as progress.
 */
export function splitLesson<T extends Record<string, unknown>>(
  lesson: T
): { meta: Record<string, unknown>; content: Record<string, unknown> } {
  const meta: Record<string, unknown> = {};
  const content: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(lesson)) {
    if ((LESSON_CONTENT_FIELDS as readonly string[]).includes(key)) content[key] = value;
    else meta[key] = value;
  }
  meta.dictationDone = countDone(lesson.completedSentences as Record<number, boolean> | undefined);
  const progress = lesson.progress as { shadowing?: { completed?: Record<number, boolean> } } | undefined;
  meta.shadowingDone = countDone(progress?.shadowing?.completed);
  return { meta, content };
}

/**
 * Joins the two documents back into one record. Without a content doc (a lesson
 * written before the split) the heavy fields come from the lesson doc.
 */
export function mergeLesson(
  meta: Record<string, unknown>,
  content: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!content) return { ...meta };
  const merged: Record<string, unknown> = { ...meta };
  for (const key of LESSON_CONTENT_FIELDS as readonly ContentField[]) {
    if (key in content) merged[key] = content[key];
  }
  return merged;
}

/** Sidebar percent from the stored count, falling back to the map on pre-split docs. */
export function donePercent(
  count: unknown,
  map: Record<number, boolean> | undefined,
  total: number
): number {
  if (total <= 0) return 0;
  const done = typeof count === 'number' ? count : countDone(map);
  return Math.min(100, Math.round((done / total) * 100));
}
