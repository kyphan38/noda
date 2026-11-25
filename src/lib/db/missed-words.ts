// Misses per word (users/{uid}/stats/missedWords), for the dictation gaps view.
// Kept apart from the per-line misses: those leave once a line is written right,
// these stay, so a word you often get wrong stays hidden in gaps.
import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import { getCurrentUidOrThrow } from './shared';

const FLUSH_MS = 2_000;
const pending = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

const wordsDoc = (uid: string) => doc(getFirebaseFirestore(), `users/${uid}/stats/missedWords`);

/** Adds one miss to each word; written within a few seconds. */
export function recordMissedWords(words: readonly string[]): void {
  for (const w of words) if (w) pending.set(w, (pending.get(w) ?? 0) + 1);
  if (pending.size > 0 && !timer) timer = setTimeout(() => void flushMissedWords(), FLUSH_MS);
}

export async function flushMissedWords(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending.size === 0) return;
  const counts: Record<string, unknown> = {};
  for (const [w, n] of pending) counts[w] = increment(n);
  pending.clear();
  let uid: string;
  try {
    uid = getCurrentUidOrThrow();
  } catch {
    return; // signed out or E2E mode: nothing to keep
  }
  await setDoc(wordsDoc(uid), { counts }, { merge: true }).catch((e) => console.warn('[missed-words] save failed', e));
}

/** Miss count per word; empty when signed out. */
export async function getMissedWordCounts(): Promise<Record<string, number>> {
  await flushMissedWords();
  const snap = await getDoc(wordsDoc(getCurrentUidOrThrow()));
  return ((snap.exists() ? snap.data().counts : null) ?? {}) as Record<string, number>;
}
