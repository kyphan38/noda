/**
 * Storage objects that belong to a lesson and must go when the lesson doc is
 * deleted. Pure (no firebase-admin import) so the app's vitest suite can test it;
 * see lib/analysisAudioPath.ts for why that matters.
 */

import { analysisAudioPath } from "./analysisAudioPath";

/**
 * The lesson's uploaded media and its analysis-audio copy. Only paths inside the
 * owner's own `users/{uid}/media/` are returned: a doc pointing anywhere else
 * (corrupt data, an older layout) is left alone rather than risk deleting a file
 * this lesson does not own. Lessons stored before `mediaPath` existed yield [].
 */
export function lessonStoragePaths(uid: string, data: { mediaPath?: unknown }): string[] {
  if (typeof data.mediaPath !== "string") return [];
  const copy = analysisAudioPath(uid, data.mediaPath);
  return copy ? [data.mediaPath, copy] : [];
}
