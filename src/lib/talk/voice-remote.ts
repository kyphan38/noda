// noda - Talk: Chirp 3 HD audio from the talkSpeak function, kept for the visit.
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/auth/firebase-client';
import { TALK_SPEAK_FUNCTION_NAME } from '@/constants';

const cache = new Map<string, Promise<string>>();
/** Lines already fetched, ready to play at once (inside the tap). */
const ready = new Map<string, string>();

export function cachedChirp(text: string): string | undefined {
  return ready.get(text);
}

/** A data URL of the line read by Chirp 3 HD. Rejects when the voice is not available. */
export function chirpAudio(text: string): Promise<string> {
  const hit = cache.get(text);
  if (hit) return hit;
  const call = httpsCallable<{ text: string }, { audio: string }>(getFirebaseFunctions(), TALK_SPEAK_FUNCTION_NAME, { timeout: 20_000 });
  const p = call({ text }).then((r) => {
    const url = `data:audio/mpeg;base64,${r.data.audio}`;
    ready.set(text, url);
    return url;
  });
  p.catch(() => cache.delete(text));
  cache.set(text, p);
  return p;
}
