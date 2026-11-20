// Talk topics (users/{uid}/talkTopics) and phrase progress (users/{uid}/talkPhraseProgress).
// The talkTopic Cloud Function makes a topic; the app reads it, hides phrases and saves progress.
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFirestore, getFirebaseFunctions } from '@/lib/auth/firebase-client';
import { TALK_TOPIC_FUNCTION_NAME } from '@/constants';
import { progressId, raiseStage } from '@/lib/talk/phrase-stage';
import type { PhraseStage, TalkLevel, TalkPhrase, TalkPhraseProgress, TalkTopic } from '@/lib/talk/types';
import { getCurrentUidOrThrow } from './shared';

const topicsPath = (uid: string) => `users/${uid}/talkTopics`;
const progressPath = (uid: string) => `users/${uid}/talkPhraseProgress`;

/** Making a topic takes a model call of up to about a minute and a half. */
const TOPIC_CLIENT_TIMEOUT_MS = 150_000;

export type TopicRequest = {
  topicId: string;
  kind: 'preset' | 'custom';
  presetId?: string;
  title: string;
  description: string;
  level: TalkLevel;
};

export async function listTalkTopics(): Promise<TalkTopic[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(collection(getFirebaseFirestore(), topicsPath(uid)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TalkTopic, 'id'>), id: d.id }));
}

export async function getTalkTopic(topicId: string): Promise<TalkTopic | null> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDoc(doc(getFirebaseFirestore(), topicsPath(uid), topicId));
  return snap.exists() ? { ...(snap.data() as Omit<TalkTopic, 'id'>), id: snap.id } : null;
}

/** Returns the saved topic, or asks the function to make it (one model call). */
export async function ensureTalkTopic(req: TopicRequest): Promise<TalkTopic> {
  const saved = await getTalkTopic(req.topicId);
  if (saved) return saved;
  const call = httpsCallable<TopicRequest, TalkTopic>(getFirebaseFunctions(), TALK_TOPIC_FUNCTION_NAME, {
    timeout: TOPIC_CLIENT_TIMEOUT_MS,
  });
  return (await call(req)).data;
}

/** Hides (or brings back) a phrase that sounds odd. */
export async function setPhraseRemoved(topic: TalkTopic, phraseId: string, removed: boolean): Promise<TalkPhrase[]> {
  const uid = getCurrentUidOrThrow();
  const phrases = topic.phrases.map((p) => (p.id === phraseId ? { ...p, removed } : p));
  await updateDoc(doc(getFirebaseFirestore(), topicsPath(uid), topic.id), { phrases });
  return phrases;
}

export async function deleteTalkTopic(topicId: string): Promise<void> {
  const uid = getCurrentUidOrThrow();
  await deleteDoc(doc(getFirebaseFirestore(), topicsPath(uid), topicId));
}

/** Progress of one topic's phrases, keyed by phrase id. */
export async function listPhraseProgress(topicId: string): Promise<Map<string, TalkPhraseProgress>> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(query(collection(getFirebaseFirestore(), progressPath(uid)), where('topicId', '==', topicId)));
  return new Map(snap.docs.map((d) => {
    const p = d.data() as TalkPhraseProgress;
    return [p.phraseId, p];
  }));
}

/** Raises each phrase to `reached` (never lowers it). Returns the new map. */
export async function savePhraseStages(
  topicId: string,
  phrases: TalkPhrase[],
  reached: PhraseStage,
  current: Map<string, TalkPhraseProgress>,
): Promise<Map<string, TalkPhraseProgress>> {
  const uid = getCurrentUidOrThrow();
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  const next = new Map(current);
  const now = Date.now();
  for (const p of phrases) {
    const prev = current.get(p.id);
    const stage = raiseStage(prev?.stage, reached);
    if (prev && stage === prev.stage) continue;
    const row: TalkPhraseProgress = { topicId, phraseId: p.id, text: p.text, stage, usedCount: prev?.usedCount ?? 0, updatedAt: now };
    batch.set(doc(db, progressPath(uid), progressId(topicId, p.id)), row);
    next.set(p.id, row);
  }
  await batch.commit();
  return next;
}
