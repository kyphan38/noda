// Sentence translations (users/{uid}/lessons/{lessonId}/translations), written by the
// translateSentences function. Read here so translated lines show at once after a reload.
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFirestore, getFirebaseFunctions } from '@/lib/auth/firebase-client';
import type { CachedTranslationDoc, TranslateBatch } from '@/lib/translate';
import { getCurrentUidOrThrow, getUserLessonsCollectionPath } from './shared';

export async function listLessonTranslations(lessonId: string): Promise<{ id: string; data: CachedTranslationDoc }[]> {
  const uid = getCurrentUidOrThrow();
  const col = collection(getFirebaseFirestore(), `${getUserLessonsCollectionPath(uid)}/${lessonId}/translations`);
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as CachedTranslationDoc }));
}

type TranslateRequest = TranslateBatch & { lessonId: string; title: string };

/** One model call for the whole batch; the server skips sentences it already has. */
export async function translateSentences(req: TranslateRequest): Promise<{ id: number; vi: string }[]> {
  // The function's model budget is 45s; leave room for the cold start.
  const call = httpsCallable<TranslateRequest, { items: { id: number; vi: string }[] }>(
    getFirebaseFunctions(),
    'translateSentences',
    { timeout: 70_000 }
  );
  return (await call(req)).data.items;
}
