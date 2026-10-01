/**
 * Token download URL for a Storage object uploaded through the Firebase client SDK.
 * Pure (no firebase-admin import) so the app's vitest suite can test it.
 *
 * Used to let ffmpeg read media over HTTPS with range requests instead of copying
 * the whole file into the function's in-memory /tmp. The token comes from the
 * object's `firebaseStorageDownloadTokens` metadata, so no URL signing (and no extra
 * IAM role) is needed.
 */
export function firebaseDownloadUrl(
  bucketName: string,
  objectPath: string,
  tokens: unknown
): string | null {
  if (typeof tokens !== "string") return null;
  const token = tokens.split(",")[0]?.trim();
  if (!token) return null;
  return (
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`
  );
}
