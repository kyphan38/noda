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
export type TalkScenario = { id: string; title: string; facts: string[]; opening: string; ideas: string[] };

export type TalkTopic = {
  id: string;
  title: string;
  description: string;
  kind: 'preset' | 'custom';
  presetId?: string;
  level: TalkLevel;
  persona: { name: string; role: string; style: string };
  scenarios: TalkScenario[];
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
  review: { correct: string; natural: string; levelUp: string; fixes: TalkFix[] };
  usedPhraseIds: string[];
};

export type TalkTurn = {
  ai: { text: string; curveball: boolean };
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

export type TalkSession = {
  id: string;
  topicId: string;
  setIndex: number;
  scenarioId: string;
  level: TalkLevel;
  mode: TalkMode;
  selfRepair: boolean;
  turns: TalkTurn[];
  startedAt: number;
  endedAt?: number;
};
