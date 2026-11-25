// noda - Talk: shapes shared by the Talk pages, db layer and pure helpers.
// Keep TalkTopic in sync with functions/src/lib/talkTopic.ts.

export const TALK_LEVELS = ['B1', 'B2', 'C1'] as const;
export type TalkLevel = (typeof TALK_LEVELS)[number];

export type TalkPhrase = {
  id: string;
  text: string;
  ipa: string;
  /** Simple English meaning, without the phrase's own words. */
  meaning: string;
  example: string;
  setIndex: number;
  removed?: boolean;
};

/** A concrete situation inside a topic: facts to talk from, never a ready answer. */
export type TalkScenario = { id: string; title: string; facts: string[]; opening: string; ideas: string[]; mood?: string };

export type TalkTopic = {
  id: string;
  title: string;
  description: string;
  kind: 'preset' | 'custom';
  presetId?: string;
  level: TalkLevel;
  persona: { name: string; role: string; style: string };
  scenarios: TalkScenario[];
  /** Your own notes the topic was made from: an agenda or ticket (context), or lines you got stuck on. */
  notes?: string;
  notesKind?: 'context' | 'stuck' | 'lesson';
  /** The lesson a 'lesson' topic was made from. */
  lessonId?: string;
  /** What this topic's character remembers about you, newest last (written by talkWrap). */
  memory?: { fact: string; at: number }[];
  phrases: TalkPhrase[];
  version: number;
  createdAt: number;
};

export type PhraseStage = 'new' | 'recognized' | 'recalled' | 'prompted' | 'active';

export type TalkPhraseProgress = {
  topicId: string;
  phraseId: string;
  text: string;
  stage: PhraseStage;
  /** A phrase you picked as one that fits you. */
  starred?: boolean;
  usedCount: number;
  updatedAt: number;
};

// Keep in sync with functions/src/lib/talkTurn.ts.
export type FixKind = 'grammar' | 'word' | 'natural' | 'tone' | 'vietlish';
export type TalkFix = { kind: FixKind; wrong: string; right: string; why: string; pattern: string };

export type TalkTurnResult = {
  transcript: string;
  seconds: number;
  reply: { text: string; curveball: boolean; ideas: string[] };
  review: { correct: string; natural: string; levelUp: string; fixes: TalkFix[]; structure?: string };
  usedPhraseIds: string[];
};

export type TalkTurn = {
  ai: { text: string; curveball: boolean; kind?: 'question' | 'share' | 'invite' };
  /** Idea notes shown for this line (the reply's ideas of the turn before). */
  ideas?: string[];
  transcript: string;
  seconds: number;
  review: TalkTurnResult['review'];
  usedPhraseIds: string[];
  /** Fixes marked "I said it right" (speech-to-text heard it wrong). */
  dismissedFixes?: number[];
  /** Word match % of the last "Say it again". */
  retryPercent?: number;
};

export type TalkMode = 'instant' | 'flow';

// Keep in sync with functions/src/lib/talkWrap.ts.
export type TalkWrap = {
  missedChances: { turn: number; phraseId: string; said: string; better: string }[];
  swaps: { from: string; to: string; why: string }[];
  closingPicks: { turn: number; idea: string; target: string }[];
  activeKeys: string[];
  focus: string;
  remember?: string[];
};

export type TalkSession = {
  id: string;
  topicId: string;
  setIndex: number;
  scenarioId: string;
  level: TalkLevel;
  mode: TalkMode;
  selfRepair: boolean;
  turns: TalkTurn[];
  /** Answers in this talk; TURN_COUNT when missing (talks made before quick mode). */
  length?: number;
  /** The talk this one does again, to compare. */
  redoOf?: string;
  /** The line waiting for an answer, so a talk left halfway goes on without a model call. */
  next?: { text: string; curveball: boolean; ideas: string[] };
  startedAt: number;
  endedAt?: number;
  /** Notes from talkWrap, saved so they are made once. */
  wrap?: TalkWrap;
  /** True once this talk's fixes went into the mistake bank. */
  banked?: boolean;
};
