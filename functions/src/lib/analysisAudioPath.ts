/**
 * Pure path helper for lib/analysisAudio.ts, kept in its own file with no
 * firebase-admin import so the app's vitest suite can import it: the root
 * Next.js build type-checks those tests, and functions/node_modules is not
 * installed on Vercel.
 */

/**
 * Storage path of the analysis copy for `mediaStoragePath`, or null when that
 * path is not inside `users/{uid}/media/` of the caller.
 */
export function analysisAudioPath(uid: string, mediaStoragePath: string): string | null {
  const prefix = `users/${uid}/media/`;
  if (!mediaStoragePath.startsWith(prefix)) return null;
  const name = mediaStoragePath.slice(prefix.length);
  if (!name || name.includes("/") || name.includes("..")) return null;
  return `users/${uid}/analysis-audio/${name}.flac`;
}
