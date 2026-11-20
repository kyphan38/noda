// noda - Talk: shapes shared by the Talk pages, db layer and pure helpers.
// Keep TalkTopic in sync with functions/src/lib/talkTopic.ts.

export const TALK_LEVELS = ['B1', 'B2', 'C1'] as const;
export type TalkLevel = (typeof TALK_LEVELS)[number];

export type TalkPhrase = {
  id: string;
  text: string;
  ipa: string;
  vi: string;
  example: string;
  setIndex: number;
  removed?: boolean;
};

export type TalkTopic = {
  id: string;
  title: string;
  description: string;
  kind: 'preset' | 'custom';
  presetId?: string;
  level: TalkLevel;
  persona: { name: string; role: string; style: string };
  opening: { text: string; vi: string };
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
