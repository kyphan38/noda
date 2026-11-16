// noda - Word card (N3) from the `defineWord` Cloud Function, kept for the visit.
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/auth/firebase-client';

export type WordCard = { word: string; ipa: string; partOfSpeech: string; meaning: string };

const cache = new Map<string, Promise<WordCard>>();

/** Meaning of `word` in `sentence`. The server keeps a copy, so a word is paid for once. */
export function lookupWord(word: string, sentence: string): Promise<WordCard> {
  const key = `${word.toLowerCase()}|${sentence}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const call = httpsCallable<{ word: string; sentence: string }, WordCard>(getFirebaseFunctions(), 'defineWord', { timeout: 30_000 });
  const p = call({ word, sentence }).then((r) => r.data);
  // A failure is not kept, so the next tap tries again.
  p.catch(() => cache.delete(key));
  cache.set(key, p);
  return p;
}
