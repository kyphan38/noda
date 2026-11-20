import { describe, expect, it } from 'vitest';
import { buildQueue } from './learn-queue';
import { addMisses, isUsableState, phraseSetKey, stateLabel, type LearnState } from './learn-state';

const phrases = [{ id: 'p1' }, { id: 'p0' }, { id: 'p2' }];
const base: LearnState = { setKey: phraseSetKey(phrases), step: 'match', matchOrder: ['p2', 'p0', 'p1'], matchRound: 0, matchMisses: {}, updatedAt: 1 };

describe('learn state', () => {
  it('keys a set by its phrase ids in any order', () => {
    expect(phraseSetKey(phrases)).toBe('p0,p1,p2');
  });
  it('is usable only for the same phrases', () => {
    expect(isUsableState(base, phrases)).toBe(true);
    expect(isUsableState(base, [{ id: 'p0' }, { id: 'p1' }])).toBe(false);
    expect(isUsableState({ ...base, matchOrder: ['p0', 'p1', 'p9'] }, phrases)).toBe(false);
    expect(isUsableState(null, phrases)).toBe(false);
  });
  it('needs a queue with items in Recall', () => {
    const queue = buildQueue(phrases.map((p) => ({ id: p.id, hasCloze: false })));
    expect(isUsableState({ ...base, step: 'drill', queue }, phrases)).toBe(true);
    expect(isUsableState({ ...base, step: 'drill' }, phrases)).toBe(false);
    expect(isUsableState({ ...base, step: 'drill', queue: { ...queue, items: [] } }, phrases)).toBe(false);
  });
  it('labels where you are', () => {
    const queue = { ...buildQueue(phrases.map((p) => ({ id: p.id, hasCloze: true }))), done: 4 };
    expect(stateLabel({ ...base, step: 'drill', queue }, 1)).toBe('Recall 5/6');
    expect(stateLabel({ ...base, matchRound: 1 }, 2)).toBe('Match round 2/2');
  });
  it('adds misses', () => {
    expect(addMisses({ a: 1 }, { a: 2, b: 1 })).toEqual({ a: 3, b: 1 });
  });
});
