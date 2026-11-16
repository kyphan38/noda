// Shadowing analysis and speaking attempts in Firestore.
import { collection, collectionGroup, getDoc, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/auth/firebase-client';
import {
  SHADOWING_ANALYSIS_VERSION,
  SPEAKING_ATTEMPT_VERSION,
  type ShadowingPatternDoc,
  type SpeakingAttempt,
} from '@/types';
import {
  getCurrentUidOrThrow,
  getUserLessonsCollectionPath,
  getShadowingAnalysisDocRef,
} from './shared';

export const getShadowingAnalysisFirestore = async (
  lessonId: string,
  sentenceId: number
): Promise<ShadowingPatternDoc | null> => {
  const uid = getCurrentUidOrThrow();
  const snapshot = await getDoc(getShadowingAnalysisDocRef(uid, lessonId, sentenceId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Omit<ShadowingPatternDoc, 'createdAt'> & {
    createdAt?: Timestamp;
  };
  // A doc from an older analysis version holds a shape the panel cannot render, so it
  // reads as a miss and the Cloud Function overwrites it. The v1 cache was deleted, but
  // this keeps a stray leftover from throwing in the panel instead of just re-analyzing.
  if (data.version !== SHADOWING_ANALYSIS_VERSION) return null;
  return {
    ...data,
    createdAt: data.createdAt?.toMillis() ?? Date.now(),
  };
};

/** Every speaking-check attempt of a lesson, oldest first (written only by the Cloud Function). */
export const listSpeakingAttemptsFirestore = async (lessonId: string): Promise<SpeakingAttempt[]> => {
  const uid = getCurrentUidOrThrow();
  const snapshot = await getDocs(
    query(
      collection(getFirebaseFirestore(), getUserLessonsCollectionPath(uid), lessonId, 'speakingAttempts'),
      orderBy('createdAt', 'asc')
    )
  );
  return snapshot.docs
    .map((d) => {
      const data = d.data() as Omit<SpeakingAttempt, 'id' | 'createdAt'> & { createdAt?: Timestamp };
      return { ...data, id: d.id, createdAt: data.createdAt?.toMillis() ?? Date.now() };
    })
    .filter((a) => a.version === SPEAKING_ATTEMPT_VERSION);
};

/**
 * Every speaking-check attempt of every lesson (collection group), oldest first,
 * with its lesson id. For the Speaking page.
 */
export const listAllSpeakingAttemptsFirestore = async (): Promise<(SpeakingAttempt & { lessonId: string })[]> => {
  const uid = getCurrentUidOrThrow();
  // No orderBy: a collection-group order needs its own index; a sort here is enough.
  const snapshot = await getDocs(collectionGroup(getFirebaseFirestore(), 'speakingAttempts'));
  const mine = `users/${uid}/lessons/`;
  return snapshot.docs
    .filter((d) => d.ref.path.startsWith(mine))
    .map((d) => {
      const data = d.data() as Omit<SpeakingAttempt, 'id' | 'createdAt'> & { createdAt?: Timestamp };
      return { ...data, id: d.id, lessonId: d.ref.parent.parent?.id ?? '', createdAt: data.createdAt?.toMillis() ?? Date.now() };
    })
    .filter((a) => a.version === SPEAKING_ATTEMPT_VERSION)
    .sort((a, b) => a.createdAt - b.createdAt);
};
