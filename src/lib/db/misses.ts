// Dictation misses per lesson (users/{uid}/misses/{lessonId}), for the Mistakes page.
// Misses are queued and written a moment later, so typing fast is not one write per key.
import { collection, deleteField, doc, getDocs, increment, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import type { MissDoc } from '@/lib/dictation-misses';
import { getCurrentUidOrThrow } from './shared';

const FLUSH_MS = 2_000;

type Pending = { lessonName: string; items: Map<number, { n: number; text: string; start: number; end: number }> };
const pending = new Map<string, Pending>();
let timer: ReturnType<typeof setTimeout> | null = null;

const missesPath = (uid: string) => `users/${uid}/misses`;

/** Adds `n` misses to a sentence; written within a few seconds. */
export function recordMiss(
  lesson: { id: string; name: string },
  sentence: { id: number; text: string; start: number; end: number },
  n: number,
): void {
  if (n <= 0) return;
  const p = pending.get(lesson.id) ?? { lessonName: lesson.name, items: new Map() };
  p.lessonName = lesson.name;
  const cur = p.items.get(sentence.id);
  p.items.set(sentence.id, { n: (cur?.n ?? 0) + n, text: sentence.text, start: sentence.start, end: sentence.end });
  pending.set(lesson.id, p);
  if (!timer) timer = setTimeout(() => void flushMisses(), FLUSH_MS);
}

export async function flushMisses(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending.size === 0) return;
  const batch = [...pending.entries()];
  pending.clear();
  let uid: string;
  try {
    uid = getCurrentUidOrThrow();
  } catch {
    return; // signed out or E2E mode: nothing to keep
  }
  const now = Date.now();
  await Promise.all(
    batch.map(([lessonId, p]) => {
      const items: Record<string, unknown> = {};
      for (const [id, it] of p.items) {
        items[String(id)] = { n: increment(it.n), text: it.text, start: it.start, end: it.end, at: now };
      }
      return setDoc(doc(getFirebaseFirestore(), missesPath(uid), lessonId), { lessonId, lessonName: p.lessonName, items }, { merge: true }).catch(
        (e) => console.warn('[misses] save failed', e),
      );
    }),
  );
}

export async function listMissesFirestore(): Promise<MissDoc[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(collection(getFirebaseFirestore(), missesPath(uid)));
  return snap.docs.map((d) => d.data() as MissDoc);
}

/** A sentence written right on the Mistakes page leaves the list. */
export async function clearMissFirestore(lessonId: string, sentenceId: number): Promise<void> {
  const uid = getCurrentUidOrThrow();
  await updateDoc(doc(getFirebaseFirestore(), missesPath(uid), lessonId), { [`items.${sentenceId}`]: deleteField() });
}
