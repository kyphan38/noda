/**
 * Small audio-only copy of a lesson's media, used as the source for shadowing
 * analysis instead of the original upload.
 *
 * Every cache miss used to download the whole original (a video can be hundreds
 * of MB) just to cut a few seconds out of it. The copy is mono 16kHz FLAC - the
 * exact samples `sliceAudioClip` already sends to Gemini, so analysis input does
 * not change - and is roughly 1MB per minute.
 *
 * Created lazily: the first analysis of a lesson builds it from the original and
 * uploads it; later analyses download only the copy. Lessons uploaded before this
 * existed need no backfill. Clients cannot read or write `analysis-audio/` (the
 * Storage rules only open `users/{uid}/media/`); only this function touches it.
 */

import type * as admin from "firebase-admin";
import { randomUUID } from "crypto";
import { unlinkSync } from "fs";
import * as os from "os";
import * as path from "path";

import { extractAnalysisAudio } from "./sliceAudio";
import { firebaseDownloadUrl } from "./firebaseDownloadUrl";

export { analysisAudioPath } from "./analysisAudioPath";

/** Typed off firebase-admin so this file does not depend on @google-cloud/storage directly. */
type Bucket = ReturnType<ReturnType<typeof admin.storage>["bucket"]>;

function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === 404;
}

function removeQuietly(p: string): void {
  try {
    unlinkSync(p);
  } catch {
    // best-effort tmp cleanup
  }
}

/**
 * Downloads the analysis copy to a local tmp file, building and uploading it
 * first if it does not exist yet. Returns the local path; the caller deletes it.
 *
 * Two first-time requests for the same lesson can race and both build the copy;
 * they write identical bytes, so the second upload is harmless.
 */
export async function fetchAnalysisAudio(
  bucket: Bucket,
  mediaStoragePath: string,
  copyPath: string
): Promise<string> {
  const localCopy = path.join(os.tmpdir(), `analysis-${randomUUID()}.flac`);

  try {
    await bucket.file(copyPath).download({ destination: localCopy });
    return localCopy;
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }

  // Preferred: ffmpeg reads the original over HTTPS (range requests), so only the
  // small FLAC lands in /tmp - which counts against the function's memory. Files
  // without a download token (not uploaded through the app) fall back to a full copy.
  const original = bucket.file(mediaStoragePath);
  const [meta] = await original.getMetadata();
  const url = firebaseDownloadUrl(bucket.name, mediaStoragePath, meta.metadata?.firebaseStorageDownloadTokens);

  const extractFromDownload = async (): Promise<void> => {
    const localOriginal = path.join(os.tmpdir(), `media-${randomUUID()}-${path.basename(mediaStoragePath)}`);
    try {
      await original.download({ destination: localOriginal });
      await extractAnalysisAudio(localOriginal, localCopy);
    } catch (e) {
      removeQuietly(localCopy);
      throw e;
    } finally {
      removeQuietly(localOriginal);
    }
  };

  if (url) {
    try {
      await extractAnalysisAudio(url, localCopy);
    } catch (e) {
      // Doc thang qua HTTPS co the crash tuy file (ffmpeg cu tung SIGSEGV) -
      // tai full ve roi trich xuat local truoc khi bo cuoc.
      console.warn(`Direct URL extract failed for ${mediaStoragePath}, falling back to download:`, (e as Error).message);
      removeQuietly(localCopy);
      await extractFromDownload();
    }
  } else {
    await extractFromDownload();
  }

  try {
    await bucket.upload(localCopy, { destination: copyPath, contentType: "audio/flac" });
  } catch (e) {
    // The analysis can still go ahead from the local copy; the next request rebuilds it.
    console.warn(`Could not store analysis audio at ${copyPath}:`, (e as Error).message);
  }
  return localCopy;
}
