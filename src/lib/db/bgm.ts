// Background music in Storage: URLs for every track, and the owner's own tracks
// (file in users/{uid}/bgm/, listing in Firestore users/{uid}/bgmTracks so every device has it).
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, type Unsubscribe } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseFirestore, getFirebaseStorage } from '@/lib/auth/firebase-client';
import { measureLevel, normalizeGain, trackNameFromFile } from '@/lib/bgMusic/loudness';
import type { BgTrack } from '@/lib/bgMusic/tracks';
import { getCurrentUidOrThrow } from './shared';

const urls = new Map<string, Promise<string>>();

/** Cached per visit. A failed lookup is dropped so the next try asks again. */
export function getBgTrackUrl(path: string): Promise<string> {
  let url = urls.get(path);
  if (!url) {
    url = getDownloadURL(ref(getFirebaseStorage(), path));
    url.catch(() => urls.delete(path));
    urls.set(path, url);
  }
  return url;
}

// ---- Own tracks ----

/** Same limit as storage.rules. */
export const MAX_BG_TRACK_BYTES = 30 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

type MyTrackRecord = { id: string; name: string; path: string; gain: number; size: number; createdAt: number };

const tracksPath = (uid: string) => `users/${uid}/bgmTracks`;

function toTrack(r: MyTrackRecord): BgTrack {
  // Prefixed so an own track never takes a default track's id.
  return { id: `mine-${r.id}`, name: r.name, category: 'mine', path: r.path, gain: r.gain };
}

const EMPTY: BgTrack[] = [];
let myTracks: BgTrack[] = EMPTY;
const listeners = new Set<() => void>();
let started = false;
const emit = () => listeners.forEach((fn) => fn());

function startWatching() {
  started = true;
  let unsubTracks: Unsubscribe | null = null;
  try {
    onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubTracks?.();
      unsubTracks = null;
      myTracks = EMPTY;
      emit();
      if (!user) return;
      const q = query(collection(getFirebaseFirestore(), tracksPath(user.uid)), orderBy('createdAt', 'asc'));
      unsubTracks = onSnapshot(
        q,
        (snap) => {
          myTracks = snap.docs.map((d) => toTrack(d.data() as MyTrackRecord));
          emit();
        },
        () => {
          myTracks = EMPTY;
          emit();
        }
      );
    });
  } catch {
    // No Firebase config (tests, E2E): no own tracks.
  }
}

/** For useSyncExternalStore: the owner's tracks, oldest first. */
export const myBgTracksStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    if (!started) startWatching();
    return () => {
      listeners.delete(fn);
    };
  },
  get: () => myTracks,
  getServer: () => EMPTY,
};

export type BgUploadState =
  | { status: 'idle' }
  | { status: 'reading'; name: string }
  | { status: 'uploading'; name: string; progress: number }
  | { status: 'error'; message: string };

const IDLE: BgUploadState = { status: 'idle' };
let upload: BgUploadState = IDLE;
let task: UploadTask | null = null;
const uploadListeners = new Set<() => void>();
function setUpload(next: BgUploadState) {
  upload = next;
  uploadListeners.forEach((fn) => fn());
}

/** Upload progress, kept here so it survives the Settings menu closing. */
export const bgUploadStore = {
  subscribe(fn: () => void) {
    uploadListeners.add(fn);
    return () => {
      uploadListeners.delete(fn);
    };
  },
  get: () => upload,
  getServer: () => IDLE,
};

export function checkBgTrackFile(file: File): string | null {
  if (!file.type.startsWith('audio/') && !AUDIO_EXT.test(file.name)) return 'Choose an audio file.';
  if (file.size > MAX_BG_TRACK_BYTES) return 'File too large (max 30MB).';
  return null;
}

/** Storage accepts audio/* only; some browsers leave the type empty. */
function audioType(file: File): string {
  if (file.type.startsWith('audio/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'wav' || ext === 'ogg' || ext === 'flac' || ext === 'aac') return `audio/${ext}`;
  return 'audio/mpeg';
}

/** Decodes the file once to measure it; the result is a playback gain. */
async function measureGain(file: File): Promise<number> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return normalizeGain(measureLevel(channels));
}

/** Returns the new track's id, or null when nothing was added. */
export async function uploadBgTrack(file: File): Promise<string | null> {
  if (upload.status === 'reading' || upload.status === 'uploading') return null;
  const problem = checkBgTrackFile(file);
  if (problem) {
    setUpload({ status: 'error', message: problem });
    return null;
  }

  const name = trackNameFromFile(file.name);
  try {
    const uid = getCurrentUidOrThrow();
    setUpload({ status: 'reading', name });
    let gain: number;
    try {
      gain = await measureGain(file);
    } catch {
      setUpload({ status: 'error', message: 'This file cannot be played.' });
      return null;
    }

    const id = doc(collection(getFirebaseFirestore(), tracksPath(uid))).id;
    const ext = (file.name.split('.').pop() ?? 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
    const path = `users/${uid}/bgm/${id}.${ext}`;
    setUpload({ status: 'uploading', name, progress: 0 });
    task = uploadBytesResumable(ref(getFirebaseStorage(), path), file, {
      contentType: audioType(file),
      cacheControl: 'private, max-age=31536000, immutable',
    });
    task.on('state_changed', (s) => {
      if (s.totalBytes > 0) setUpload({ status: 'uploading', name, progress: s.bytesTransferred / s.totalBytes });
    });
    await task;
    const record: MyTrackRecord = { id, name, path, gain, size: file.size, createdAt: Date.now() };
    await setDoc(doc(getFirebaseFirestore(), tracksPath(uid), id), record);
    setUpload(IDLE);
    return toTrack(record).id;
  } catch (error) {
    const canceled = (error as { code?: string } | null)?.code === 'storage/canceled';
    setUpload(canceled ? IDLE : { status: 'error', message: 'Upload failed. Try again.' });
    return null;
  } finally {
    task = null;
  }
}

export function cancelBgUpload(): void {
  task?.cancel();
}

export function clearBgUploadError(): void {
  if (upload.status === 'error') setUpload(IDLE);
}

/** Removes an own track: the listing first, so it leaves every device at once. */
export async function deleteBgTrack(track: BgTrack): Promise<void> {
  if (track.category !== 'mine') return;
  const uid = getCurrentUidOrThrow();
  await deleteDoc(doc(getFirebaseFirestore(), tracksPath(uid), track.id.replace(/^mine-/, '')));
  try {
    await deleteObject(ref(getFirebaseStorage(), track.path));
  } catch {
    // Already gone, or offline: the listing is what the app reads.
  }
}
