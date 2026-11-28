// Background music: download URLs for the tracks in Storage defaults/bgm/.
import { getDownloadURL, ref } from 'firebase/storage';
import { getFirebaseStorage } from '@/lib/auth/firebase-client';

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
