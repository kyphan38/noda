// noda - Talk: where you are in Learn, so leaving halfway (for example in
// Recall) does not mean matching again. Saved after every answer. Pure.

import type { LearnQueue } from './learn-queue';
import type { TalkPhrase } from './types';

export type LearnState = {
  /** The set's phrases when it was saved; a hidden or new phrase makes the state stale. */
  setKey: string;
  step: 'match' | 'drill';
  /** Phrase ids in the shuffled match order, so rounds come back the same. */
  matchOrder: string[];
  matchRound: number;
  /** Wrong picks in Match; Recall keeps its own in the queue. */
  matchMisses: Record<string, number>;
  queue?: LearnQueue;
  updatedAt: number;
};

/** The set's live phrases, in a stable order, as one key. */
export function phraseSetKey(phrases: Pick<TalkPhrase, 'id'>[]): string {
  return phrases
    .map((p) => p.id)
    .sort()
    .join(',');
}

/** The saved state still fits this set: same phrases, and every id in it is one of them. */
export function isUsableState(s: LearnState | null | undefined, phrases: Pick<TalkPhrase, 'id'>[]): s is LearnState {
  if (!s || s.setKey !== phraseSetKey(phrases)) return false;
  const ids = new Set(phrases.map((p) => p.id));
  if (s.step === 'match') return s.matchOrder.length === ids.size && s.matchOrder.every((id) => ids.has(id));
  return !!s.queue && s.queue.items.length > 0 && s.queue.items.every((i) => ids.has(i.phraseId));
}

/** "Recall 5/18" or "Match round 2/2": where the saved state is, for the resume note. */
export function stateLabel(s: LearnState, rounds: number): string {
  if (s.step === 'drill' && s.queue) return `Recall ${s.queue.done + 1}/${s.queue.total}`;
  return `Match round ${s.matchRound + 1}/${rounds}`;
}

export function addMisses(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [id, n] of Object.entries(b)) out[id] = (out[id] ?? 0) + n;
  return out;
}
