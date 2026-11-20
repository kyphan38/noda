// noda - Talk: how well a phrase is known. It only goes up. Pure.

import type { PhraseStage, TalkPhrase, TalkPhraseProgress } from './types';

const ORDER: PhraseStage[] = ['new', 'recognized', 'recalled', 'prompted', 'active'];

export function raiseStage(current: PhraseStage | undefined, reached: PhraseStage): PhraseStage {
  const cur = current ?? 'new';
  return ORDER.indexOf(reached) > ORDER.indexOf(cur) ? reached : cur;
}

export function stageAtLeast(stage: PhraseStage | undefined, min: PhraseStage): boolean {
  return ORDER.indexOf(stage ?? 'new') >= ORDER.indexOf(min);
}

/** Firestore id of a phrase's progress doc. */
export function progressId(topicId: string, phraseId: string): string {
  return `${topicId}__${phraseId}`;
}

export type SetSummary = { setIndex: number; total: number; learned: number };

/** Per set: live phrases and how many are recalled or better. Sets with no live phrase are left out. */
export function summarizeSets(phrases: TalkPhrase[], progress: Map<string, TalkPhraseProgress>): SetSummary[] {
  const bySet = new Map<number, SetSummary>();
  for (const p of phrases) {
    if (p.removed) continue;
    const s = bySet.get(p.setIndex) ?? { setIndex: p.setIndex, total: 0, learned: 0 };
    s.total++;
    if (stageAtLeast(progress.get(p.id)?.stage, 'recalled')) s.learned++;
    bySet.set(p.setIndex, s);
  }
  return [...bySet.values()].sort((a, b) => a.setIndex - b.setIndex);
}
