// noda - Talk: where topics and progress live. Firestore normally; in E2E mode
// (no sign-in) one sample topic in memory, so the screens can be tested.
import * as fsdb from '@/lib/db';
import { raiseStage } from './phrase-stage';
import type { TalkCapture } from './capture';
import type { TalkMistake } from './mistake-bank';
import type { PhraseStage, TalkPhrase, TalkPhraseProgress, TalkSession, TalkTopic, TalkTurnResult, TalkWrap } from './types';

export type TalkStore = {
  listTopics(): Promise<TalkTopic[]>;
  ensureTopic(req: fsdb.TopicRequest): Promise<TalkTopic>;
  setPhraseRemoved(topic: TalkTopic, phraseId: string, removed: boolean): Promise<TalkPhrase[]>;
  deleteTopic(topicId: string): Promise<void>;
  listProgress(topicId: string): Promise<Map<string, TalkPhraseProgress>>;
  saveStages(topicId: string, phrases: TalkPhrase[], reached: PhraseStage, current: Map<string, TalkPhraseProgress>): Promise<Map<string, TalkPhraseProgress>>;
  runTurn(payload: fsdb.TurnPayload): Promise<TalkTurnResult>;
  saveSession(session: TalkSession): Promise<void>;
  findOpenSession(topicId: string, setIndex: number): Promise<TalkSession | null>;
  wrapSession(sessionId: string, known: { key: string; text: string }[]): Promise<TalkWrap>;
  listMistakes(): Promise<TalkMistake[]>;
  saveMistakes(rows: TalkMistake[]): Promise<void>;
  listPrompted(): Promise<TalkPhraseProgress[]>;
  markActive(keys: string[]): Promise<void>;
  listCaptures(): Promise<TalkCapture[]>;
  addCapture(text: string): Promise<TalkCapture>;
  deleteCapture(id: string): Promise<void>;
  markCapturesUsed(ids: string[], topicId: string): Promise<void>;
  listSessions(since: number): Promise<TalkSession[]>;
  getSession(id: string): Promise<TalkSession | null>;
};

const firestoreStore: TalkStore = {
  listTopics: fsdb.listTalkTopics,
  ensureTopic: fsdb.ensureTalkTopic,
  setPhraseRemoved: fsdb.setPhraseRemoved,
  deleteTopic: fsdb.deleteTalkTopic,
  listProgress: fsdb.listPhraseProgress,
  saveStages: fsdb.savePhraseStages,
  runTurn: fsdb.requestTalkTurn,
  saveSession: fsdb.saveTalkSession,
  findOpenSession: fsdb.findOpenTalkSession,
  wrapSession: fsdb.requestTalkWrap,
  listMistakes: fsdb.listTalkMistakes,
  saveMistakes: fsdb.saveTalkMistakes,
  listPrompted: fsdb.listPromptedPhrases,
  markActive: fsdb.markPhrasesActive,
  listCaptures: fsdb.listTalkCaptures,
  addCapture: fsdb.addTalkCapture,
  deleteCapture: fsdb.deleteTalkCapture,
  markCapturesUsed: fsdb.markCapturesUsed,
  listSessions: fsdb.listTalkSessions,
  getSession: fsdb.getTalkSession,
};

const SAMPLE: [string, string, string][] = [
  ['wrap up', 'finish the last part of some work', 'I need to wrap up the login refactor today.'],
  ['pick up a ticket', 'start working on a task from the list', 'After that I will pick up a ticket from the backlog.'],
  ['I am blocked on', 'I cannot go on until something is done', 'I am blocked on the API keys from the platform team.'],
  ['ship it', 'release the work to users', 'If the tests pass, we can ship it this afternoon.'],
  ['run into an issue', 'meet a problem you did not expect', 'Yesterday I ran into an issue with the cache.'],
  ['on track', 'going as planned, not late', 'The payment work is still on track for Friday.'],
  ['sync offline', 'talk about it later, outside the meeting', 'Can we sync offline about the schema change?'],
  ['take a look at', 'check something quickly', 'Could someone take a look at my pull request?'],
  ['a quick update', 'short news about how work is going', 'Just a quick update on the search bug.'],
  ['nothing major', 'no big problems or news', 'Nothing major from my side today.'],
];

function sampleTopic(): TalkTopic {
  return {
    id: 'standup-b2',
    title: 'Daily standup',
    description: 'Sample topic for E2E mode.',
    kind: 'preset',
    presetId: 'standup',
    level: 'B2',
    persona: { name: 'Dana', role: 'Engineering manager', style: 'Calm and direct.' },
    scenarios: [
      {
        id: 's0',
        title: 'Pipeline broke after a runner update',
        facts: ['CI runners updated Monday night', 'Docker builds failed for 3 hours', 'Rolled back runner image', 'Release moved to Wednesday'],
        opening: 'Morning! I saw some red builds yesterday. What happened?',
        ideas: ['runner image update', 'how long builds failed', 'the rollback'],
      },
    ],
    phrases: SAMPLE.map(([text, meaning, example], i) => ({ id: `p${i}`, text, ipa: '', meaning, example, setIndex: 0 })),
    version: 1,
    createdAt: 0,
  };
}

function memoryStore(): TalkStore {
  const topics = new Map<string, TalkTopic>();
  const progress = new Map<string, Map<string, TalkPhraseProgress>>();
  const sessions = new Map<string, TalkSession>();
  const mistakes = new Map<string, TalkMistake>();
  const captures = new Map<string, TalkCapture>();
  return {
    listTopics: async () => [...topics.values()],
    ensureTopic: async (req) => {
      const t = topics.get(req.topicId) ?? { ...sampleTopic(), id: req.topicId, title: req.title, kind: req.kind, level: req.level, notes: req.notes, notesKind: req.notesKind };
      topics.set(t.id, t);
      return t;
    },
    setPhraseRemoved: async (topic, phraseId, removed) => {
      const phrases = topic.phrases.map((p) => (p.id === phraseId ? { ...p, removed } : p));
      topics.set(topic.id, { ...topic, phrases });
      return phrases;
    },
    deleteTopic: async (id) => void topics.delete(id),
    listProgress: async (topicId) => new Map(progress.get(topicId)),
    saveStages: async (topicId, phrases, reached, current) => {
      const next = new Map(current);
      for (const p of phrases) {
        const prev = next.get(p.id);
        next.set(p.id, { topicId, phraseId: p.id, text: p.text, stage: raiseStage(prev?.stage, reached), usedCount: prev?.usedCount ?? 0, updatedAt: Date.now() });
      }
      progress.set(topicId, next);
      return new Map(next);
    },
    // A fixed answer with one mistake, so the review screens can be tested without the model.
    runTurn: async (payload) => {
      await new Promise((r) => setTimeout(r, 300));
      return {
        transcript: 'Yesterday I am working on the login and I wrap up it.',
        seconds: 4,
        reply: {
          text: payload.isLast ? 'Great, thanks for the update.' : 'Nice. Is anything blocking you today?',
          curveball: payload.curveball,
          ideas: payload.isLast ? [] : ['the release date', 'who you need'],
        },
        review: {
          correct: 'Yesterday I was working on the login and I wrapped it up.',
          natural: 'Yesterday I worked on the login and wrapped it up.',
          levelUp: 'Yesterday I focused on the login flow and wrapped it up.',
          fixes: [
            { kind: 'grammar', wrong: 'I am working', right: 'I was working', why: 'It happened yesterday, so use the past.', pattern: 'verb_tense' },
            { kind: 'word', wrong: 'wrap up it', right: 'wrapped it up', why: 'Put "it" between "wrap" and "up".', pattern: 'word_order' },
          ],
        },
        usedPhraseIds: payload.targetIds.slice(0, 1),
      };
    },
    saveSession: async (s) => void sessions.set(s.id, { ...sessions.get(s.id), ...s }),
    wrapSession: async (sessionId) => {
      const s = sessions.get(sessionId);
      if (s?.wrap) return s.wrap;
      const wrap: TalkWrap = {
        missedChances: [{ turn: 0, phraseId: 'p3', said: 'it is done', better: "If the tests pass, we can ship it." }],
        swaps: [{ from: 'very big', to: 'huge', why: 'One strong word sounds more natural.' }],
        closingPicks: (s?.turns ?? []).slice(0, 3).map((t, turn) => ({ turn, idea: 'say what you finished yesterday', target: t.review.natural })),
        activeKeys: [],
        focus: 'Use the past tense for work you already finished.',
      };
      if (s) sessions.set(sessionId, { ...s, wrap });
      return wrap;
    },
    listMistakes: async () => [...mistakes.values()],
    saveMistakes: async (rows) => rows.forEach((m) => mistakes.set(m.pattern, m)),
    listPrompted: async () => [...progress.values()].flatMap((m) => [...m.values()]).filter((p) => p.stage === 'prompted'),
    markActive: async () => {},
    listCaptures: async () => [...captures.values()],
    addCapture: async (text) => {
      const row = { id: `c${captures.size}-${Date.now()}`, text, createdAt: Date.now() };
      captures.set(row.id, row);
      return row;
    },
    deleteCapture: async (id) => void captures.delete(id),
    listSessions: async (since) => [...sessions.values()].filter((s) => s.startedAt >= since),
    getSession: async (id) => sessions.get(id) ?? null,
    markCapturesUsed: async (ids, topicId) => ids.forEach((id) => captures.has(id) && captures.set(id, { ...captures.get(id)!, usedInTopicId: topicId })),
    findOpenSession: async (topicId, setIndex) =>
      [...sessions.values()].filter((s) => s.topicId === topicId && s.setIndex === setIndex && !s.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null,
  };
}

let store: TalkStore | null = null;

export function getTalkStore(): TalkStore {
  // Same switch as useAuthGate: never in a production build.
  const e2e = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E_MODE === 'true';
  if (!store) store = e2e ? memoryStore() : firestoreStore;
  return store;
}
