// noda - Talk: where topics and progress live. Firestore normally; in E2E mode
// (no sign-in) one sample topic in memory, so the screens can be tested.
import * as fsdb from '@/lib/db';
import { raiseStage } from './phrase-stage';
import type { PhraseStage, TalkPhrase, TalkPhraseProgress, TalkTopic } from './types';

export type TalkStore = {
  listTopics(): Promise<TalkTopic[]>;
  ensureTopic(req: fsdb.TopicRequest): Promise<TalkTopic>;
  setPhraseRemoved(topic: TalkTopic, phraseId: string, removed: boolean): Promise<TalkPhrase[]>;
  deleteTopic(topicId: string): Promise<void>;
  listProgress(topicId: string): Promise<Map<string, TalkPhraseProgress>>;
  saveStages(topicId: string, phrases: TalkPhrase[], reached: PhraseStage, current: Map<string, TalkPhraseProgress>): Promise<Map<string, TalkPhraseProgress>>;
};

const firestoreStore: TalkStore = {
  listTopics: fsdb.listTalkTopics,
  ensureTopic: fsdb.ensureTalkTopic,
  setPhraseRemoved: fsdb.setPhraseRemoved,
  deleteTopic: fsdb.deleteTalkTopic,
  listProgress: fsdb.listPhraseProgress,
  saveStages: fsdb.savePhraseStages,
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
    opening: { text: 'Morning! What did you work on yesterday?' },
    phrases: SAMPLE.map(([text, meaning, example], i) => ({ id: `p${i}`, text, ipa: '', meaning, example, setIndex: 0 })),
    version: 1,
    createdAt: 0,
  };
}

function memoryStore(): TalkStore {
  const topics = new Map<string, TalkTopic>();
  const progress = new Map<string, Map<string, TalkPhraseProgress>>();
  return {
    listTopics: async () => [...topics.values()],
    ensureTopic: async (req) => {
      const t = topics.get(req.topicId) ?? { ...sampleTopic(), id: req.topicId, title: req.title, kind: req.kind, level: req.level };
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
  };
}

let store: TalkStore | null = null;

export function getTalkStore(): TalkStore {
  // Same switch as useAuthGate: never in a production build.
  const e2e = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E_MODE === 'true';
  if (!store) store = e2e ? memoryStore() : firestoreStore;
  return store;
}
