// Talk topics (users/{uid}/talkTopics), sessions (talkSessions) and phrase progress (talkPhraseProgress).
// The talkTopic Cloud Function makes a topic; the app reads it, hides phrases and saves progress.
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseFunctions, getFirebaseStorage } from '@/lib/auth/firebase-client';
import { TALK_HINT_FUNCTION_NAME, TALK_SPEECH_FUNCTION_NAME, TALK_TOPIC_FUNCTION_NAME, TALK_TURN_FUNCTION_NAME, TALK_WRAP_FUNCTION_NAME } from '@/constants';
import type { TalkCapture } from '@/lib/talk/capture';
import type { TalkCapsule } from '@/lib/talk/drills';
import type { TalkMistake } from '@/lib/talk/mistake-bank';
import { progressId, raiseStage } from '@/lib/talk/phrase-stage';
import type { PhraseStage, TalkLevel, TalkPhrase, TalkPhraseProgress, TalkSession, TalkTopic, TalkTurnResult, TalkWrap } from '@/lib/talk/types';
import { getCurrentUidOrThrow } from './shared';

const topicsPath = (uid: string) => `users/${uid}/talkTopics`;
const progressPath = (uid: string) => `users/${uid}/talkPhraseProgress`;
const sessionsPath = (uid: string) => `users/${uid}/talkSessions`;
const mistakesPath = (uid: string) => `users/${uid}/talkMistakes`;
const capturesPath = (uid: string) => `users/${uid}/talkCaptures`;

/** Making a topic takes a model call of up to about a minute and a half. */
const TOPIC_CLIENT_TIMEOUT_MS = 150_000;
/** Keep above `timeoutSeconds` in functions/src/talkTurn.ts. */
const TURN_CLIENT_TIMEOUT_MS = 130_000;

export type TopicRequest = {
  topicId: string;
  kind: 'preset' | 'custom';
  presetId?: string;
  title: string;
  description: string;
  level: TalkLevel;
  notes?: string;
  notesKind?: 'context' | 'stuck';
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
    const row: TalkPhraseProgress = { ...prev, topicId, phraseId: p.id, text: p.text, stage, usedCount: prev?.usedCount ?? 0, updatedAt: now };
    batch.set(doc(db, progressPath(uid), progressId(topicId, p.id)), row);
    next.set(p.id, row);
  }
  await batch.commit();
  return next;
}

export type TurnPayload = {
  topicId: string;
  scenarioId: string;
  aiLine: string;
  history: { ai: string; you: string }[];
  targetIds: string[];
  curveball: boolean;
  isLast: boolean;
  replyKind: 'question' | 'share' | 'invite';
  when: string;
  recording: string;
  recordingMimeType: string;
};

/** One spoken answer -> transcript, the persona's next line and a review (one model call). */
export async function requestTalkTurn(payload: TurnPayload): Promise<TalkTurnResult> {
  const call = httpsCallable<TurnPayload, TalkTurnResult>(getFirebaseFunctions(), TALK_TURN_FUNCTION_NAME, {
    timeout: TURN_CLIENT_TIMEOUT_MS,
  });
  return (await call(payload)).data;
}

/** The newest talk on this set that was left before the end, if any. */
export async function findOpenTalkSession(topicId: string, setIndex: number): Promise<TalkSession | null> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(query(collection(getFirebaseFirestore(), sessionsPath(uid)), where('topicId', '==', topicId)));
  const open = snap.docs
    .map((d) => ({ ...(d.data() as Omit<TalkSession, 'id'>), id: d.id }))
    .filter((s) => s.setIndex === setIndex && !s.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  return open[0] ?? null;
}

/** The whole session in one doc; written after every turn so nothing is lost. */
export async function saveTalkSession(session: TalkSession): Promise<void> {
  const uid = getCurrentUidOrThrow();
  const { id, ...data } = session;
  // Merge: talkWrap writes `wrap` on the same doc and must not be lost.
  await setDoc(doc(getFirebaseFirestore(), sessionsPath(uid), id), JSON.parse(JSON.stringify(data)), { merge: true });
}

/** Notes for a finished talk; the function saves them, so a second call is free. */
export async function requestTalkWrap(sessionId: string, known: { key: string; text: string }[]): Promise<TalkWrap> {
  const call = httpsCallable<{ sessionId: string; known: { key: string; text: string }[] }, TalkWrap>(getFirebaseFunctions(), TALK_WRAP_FUNCTION_NAME, {
    timeout: TURN_CLIENT_TIMEOUT_MS,
  });
  return (await call({ sessionId, known })).data;
}

export async function listTalkMistakes(): Promise<TalkMistake[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(collection(getFirebaseFirestore(), mistakesPath(uid)));
  return snap.docs.map((d) => d.data() as TalkMistake);
}

export async function saveTalkMistakes(rows: TalkMistake[]): Promise<void> {
  if (rows.length === 0) return;
  const uid = getCurrentUidOrThrow();
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  for (const m of rows) batch.set(doc(db, mistakesPath(uid), m.pattern), m);
  await batch.commit();
}

/** Phrases used with the checklist but not yet on your own (any topic). */
export async function listPromptedPhrases(): Promise<TalkPhraseProgress[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(query(collection(getFirebaseFirestore(), progressPath(uid)), where('stage', '==', 'prompted')));
  return snap.docs.map((d) => d.data() as TalkPhraseProgress).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Marks phrases (by progress id) as used without help. */
export async function markPhrasesActive(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const uid = getCurrentUidOrThrow();
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  for (const k of keys) batch.update(doc(db, progressPath(uid), k), { stage: 'active', updatedAt: Date.now() });
  await batch.commit();
}

export async function listTalkCaptures(): Promise<TalkCapture[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(collection(getFirebaseFirestore(), capturesPath(uid)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TalkCapture, 'id'>), id: d.id }));
}

export async function addTalkCapture(text: string): Promise<TalkCapture> {
  const uid = getCurrentUidOrThrow();
  const row = { text, createdAt: Date.now() };
  const ref = doc(collection(getFirebaseFirestore(), capturesPath(uid)));
  await setDoc(ref, row);
  return { ...row, id: ref.id };
}

export async function deleteTalkCapture(id: string): Promise<void> {
  const uid = getCurrentUidOrThrow();
  await deleteDoc(doc(getFirebaseFirestore(), capturesPath(uid), id));
}

/** Lines turned into a practice topic leave the "not practiced" count. */
export async function markCapturesUsed(ids: string[], topicId: string): Promise<void> {
  if (ids.length === 0) return;
  const uid = getCurrentUidOrThrow();
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  for (const id of ids) batch.update(doc(db, capturesPath(uid), id), { usedInTopicId: topicId });
  await batch.commit();
}

/** Talks started since `since` (ms), for the streak and the week card. */
export async function listTalkSessions(since: number): Promise<TalkSession[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(query(collection(getFirebaseFirestore(), sessionsPath(uid)), where('startedAt', '>=', since)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TalkSession, 'id'>), id: d.id }));
}

export async function getTalkSession(id: string): Promise<TalkSession | null> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDoc(doc(getFirebaseFirestore(), sessionsPath(uid), id));
  return snap.exists() ? { ...(snap.data() as Omit<TalkSession, 'id'>), id: snap.id } : null;
}

/** Stars (or unstars) a phrase that fits you; keeps its stage. */
export async function setPhraseStar(topicId: string, p: TalkPhrase, starred: boolean, prev?: TalkPhraseProgress): Promise<TalkPhraseProgress> {
  const uid = getCurrentUidOrThrow();
  const row: TalkPhraseProgress = { topicId, phraseId: p.id, text: p.text, stage: prev?.stage ?? 'new', usedCount: prev?.usedCount ?? 0, starred, updatedAt: Date.now() };
  await setDoc(doc(getFirebaseFirestore(), progressPath(uid), progressId(topicId, p.id)), row);
  return row;
}

export async function listStarredPhrases(): Promise<TalkPhraseProgress[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(query(collection(getFirebaseFirestore(), progressPath(uid)), where('starred', '==', true)));
  return snap.docs.map((d) => d.data() as TalkPhraseProgress);
}

export type TalkHint = { text: string; use: string };

/** Hint level 2: chunks to say an idea typed in simple words (one small model call). */
export async function requestTalkHint(topicId: string, aiLine: string, idea: string): Promise<TalkHint[]> {
  const call = httpsCallable<{ topicId: string; aiLine: string; idea: string }, { hints: TalkHint[] }>(getFirebaseFunctions(), TALK_HINT_FUNCTION_NAME, {
    timeout: 40_000,
  });
  return (await call({ topicId, aiLine, idea })).data.hints;
}

export type SpeechResult = {
  transcript: string;
  seconds: number;
  points: { point: string; covered: boolean }[];
  model: string;
  fixes: import('@/lib/talk/types').TalkFix[];
};

/** A longer recording: exact words (transcribe) or a retell of `source` checked for key points. */
export async function requestTalkSpeech(p: { mode: 'transcribe' | 'retell'; source: string; recording: string; recordingMimeType: string }): Promise<SpeechResult> {
  const call = httpsCallable<typeof p, SpeechResult>(getFirebaseFunctions(), TALK_SPEECH_FUNCTION_NAME, { timeout: 160_000 });
  return (await call(p)).data;
}

const capsulesPath = (uid: string) => `users/${uid}/talkCapsules`;

export async function listTalkCapsules(): Promise<TalkCapsule[]> {
  const uid = getCurrentUidOrThrow();
  const snap = await getDocs(collection(getFirebaseFirestore(), capsulesPath(uid)));
  return snap.docs.map((d) => d.data() as TalkCapsule).sort((a, b) => a.month.localeCompare(b.month));
}

/** Uploads this month's recording and saves it with its transcript. */
export async function saveTalkCapsule(month: string, blob: Blob, seconds: number, transcript: string): Promise<TalkCapsule> {
  const uid = getCurrentUidOrThrow();
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const storagePath = `users/${uid}/talkCapsules/${month}.${ext}`;
  const objectRef = ref(getFirebaseStorage(), storagePath);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'audio/webm' });
  const row: TalkCapsule = { month, storagePath, url: await getDownloadURL(objectRef), seconds, transcript, createdAt: Date.now() };
  await setDoc(doc(getFirebaseFirestore(), capsulesPath(uid), month), row);
  return row;
}

/** Makes the topic's character forget what it remembered about you. */
export async function forgetTopicMemory(topicId: string): Promise<void> {
  const uid = getCurrentUidOrThrow();
  await updateDoc(doc(getFirebaseFirestore(), topicsPath(uid), topicId), { memory: [] });
}
