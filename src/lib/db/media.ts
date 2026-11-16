// Lesson media upload to Firebase Storage.
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseStorage } from '@/lib/auth/firebase-client';
import { getCurrentUidOrThrow, getUserMediaCollectionPath } from './shared';
import type { LessonRecord, UploadedLessonMedia } from './types';

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
};

/** Extension → MIME map. Mobile browsers (esp. Android "content://" pickers) often report
 *  `file.type` as `''` or `'application/octet-stream'` for camera-roll videos/audio, even
 *  though the file itself is playable. If we upload with that unreliable type, Firebase
 *  Storage serves the same bad Content-Type header, and <video>/<audio> playback then fails
 *  on mobile with "Could not load media file" (desktop browsers are more lenient and sniff
 *  the file instead). Fall back to guessing from the file extension in that case. */
const EXTENSION_MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

const resolveUploadContentType = (file: File): string | undefined => {
  const reportedType = file.type;
  const isUnreliable = !reportedType || reportedType === 'application/octet-stream';
  if (!isUnreliable) return reportedType;

  const ext = (file.name || '').toLowerCase().split('.').pop() ?? '';
  return EXTENSION_MIME_MAP[ext] ?? reportedType ?? undefined;
};

/**
 * Upload lesson media to Firebase Storage under users/{uid}/media.
 * Returns remote path + public download URL for Firestore persistence.
 * `onProgress` receives the uploaded share, 0..1.
 */
export const uploadLessonMediaToFirebase = async (
  lessonId: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<UploadedLessonMedia> => {
  const uid = getCurrentUidOrThrow();
  const safeName = sanitizeFileName(file.name || 'media.bin');
  const objectPath = `${getUserMediaCollectionPath(uid)}/${lessonId}-${Date.now()}-${safeName}`;
  const objectRef = ref(getFirebaseStorage(), objectPath);
  const task = uploadBytesResumable(objectRef, file, {
    contentType: resolveUploadContentType(file),
  });
  if (onProgress) {
    task.on('state_changed', (s) => {
      if (s.totalBytes > 0) onProgress(s.bytesTransferred / s.totalBytes);
    });
  }
  const snapshot = await task;
  const downloadURL = await getDownloadURL(snapshot.ref);
  return {
    path: objectPath,
    downloadURL,
    contentType: snapshot.metadata.contentType ?? file.type ?? null,
    size: snapshot.metadata.size ?? file.size,
  };
};

/**
 * Resolve a playable URL for a lesson, preferring a freshly minted download URL
 * over the `mediaUrl` frozen into the document at upload time.
 *
 * `mediaUrl` embeds both the bucket name and a download token, so it rots the
 * moment either changes - moving to another Firebase project, rotating the
 * token, or restoring media into a new bucket. `mediaPath` is relative and
 * survives all of that, so re-deriving the URL from it keeps playback working.
 * Falls back to the stored `mediaUrl` when the path is missing (older rows) or
 * when Storage is unreachable, so this can only ever improve on the old
 * behaviour, never regress it.
 *
 * See PLAN-project-split.md section 1 (the mediaUrl trap).
 */
export const resolveLessonMediaUrl = async (
  lesson: Pick<LessonRecord, 'mediaPath' | 'mediaUrl'>
): Promise<string | null> => {
  if (lesson.mediaPath) {
    try {
      return await getDownloadURL(ref(getFirebaseStorage(), lesson.mediaPath));
    } catch (error) {
      console.warn(
        `[noda] could not refresh media URL for ${lesson.mediaPath}; ` +
          'falling back to the stored mediaUrl.',
        error
      );
    }
  }
  return lesson.mediaUrl ?? null;
};

/** Writes a whole lesson: metadata to the lesson doc, heavy fields to `content/main`. */
