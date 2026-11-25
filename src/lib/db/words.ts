// Word cards (users/{uid}/words), written by the defineWord function. Read here to find
// the words looked up in one lesson.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import { getCurrentUidOrThrow } from './shared';

/** Firestore allows at most 30 values in one `in` query. */
const IN_LIMIT = 30;

export type LookedUpWord = { word: string; sentence: string };

/** Same clean-up as checkWordRequest in functions/src/lib/wordCard.ts, so the texts match. */
export const wordSentenceKey = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Word cards whose sentence is one of `sentences`: the words looked up in a lesson. */
export async function listWordsForSentences(sentences: readonly string[]): Promise<LookedUpWord[]> {
  const uid = getCurrentUidOrThrow();
  const keys = [...new Set(sentences.map(wordSentenceKey).filter(Boolean))];
  const col = collection(getFirebaseFirestore(), `users/${uid}/words`);
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += IN_LIMIT) chunks.push(keys.slice(i, i + IN_LIMIT));
  const snaps = await Promise.all(chunks.map((c) => getDocs(query(col, where('sentence', 'in', c)))));
  return snaps.flatMap((s) => s.docs.map((d) => d.data() as LookedUpWord)).filter((w) => w.word && w.sentence);
}
