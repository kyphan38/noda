import { describe, expect, it } from 'vitest';
import { answerItem, buildQueue, currentItem, isQueueDone, matchingRounds, shuffle } from './learn-queue';
import { isPhraseSpoken, isPhraseTyped, makeCloze, phraseHint } from './phrase-check';
import { progressId, raiseStage, stageAtLeast, summarizeSets } from './phrase-stage';
import { pickVoice } from './speak';
import type { TalkPhrase, TalkPhraseProgress } from './types';

describe('pickVoice', () => {
  const v = (name: string, lang: string) => ({ name, lang });
  it('prefers natural en-US voices, then Google, then any English', () => {
    expect(pickVoice([v('Google US English', 'en-US'), v('Microsoft Aria Online (Natural)', 'en-US')])?.name).toContain('Natural');
    expect(pickVoice([v('Samantha', 'en-US'), v('Google US English', 'en-US')])?.name).toBe('Google US English');
    expect(pickVoice([v('Linh', 'vi-VN'), v('Daniel', 'en-GB')])?.name).toBe('Daniel');
    expect(pickVoice([v('Linh', 'vi-VN')])).toBeNull();
  });
});

describe('makeCloze', () => {
  it('cuts the phrase out, ignoring case', () => {
    expect(makeCloze('We had to Roll back the deploy last night.', 'roll back the deploy')).toEqual({
      before: 'We had to ',
      after: ' last night.',
      answer: 'Roll back the deploy',
    });
  });
  it('gives null when the phrase is not there word for word', () => {
    expect(makeCloze('We rolled back the deploy.', 'roll back the deploy')).toBeNull();
    expect(makeCloze('Anything.', '  ')).toBeNull();
  });
});

describe('answer checks', () => {
  it('accepts typed answers that differ only in case, spaces and punctuation', () => {
    expect(isPhraseTyped('  Push a  HOTFIX. ', 'push a hotfix')).toBe(true);
    expect(isPhraseTyped('I’m on it', "I'm on it")).toBe(true);
    expect(isPhraseTyped('push hotfix', 'push a hotfix')).toBe(false);
    expect(isPhraseTyped('', 'push a hotfix')).toBe(false);
  });
  it('accepts a spoken answer with every phrase word in order', () => {
    expect(isPhraseSpoken('so I will push a hotfix today', 'push a hotfix')).toBe(true);
    expect(isPhraseSpoken('push hotfix', 'push a hotfix')).toBe(false);
  });
  it('hints with first letters', () => {
    expect(phraseHint("push a hotfix, I'm")).toBe("p___ a h_____, I'_");
  });
});

describe('learn queue', () => {
  const phrases = [
    { id: 'a', hasCloze: true },
    { id: 'b', hasCloze: false },
    { id: 'c', hasCloze: true },
  ];
  it('puts blanks first, then recall for every phrase', () => {
    const q = buildQueue(phrases);
    expect(q.items.map((i) => `${i.kind}:${i.phraseId}`)).toEqual(['cloze:a', 'cloze:c', 'recall:a', 'recall:b', 'recall:c']);
    expect(q.total).toBe(5);
  });
  it('moves a miss 3 places back and counts it', () => {
    let q = buildQueue(phrases);
    q = answerItem(q, false);
    expect(q.items.map((i) => `${i.kind}:${i.phraseId}`)).toEqual(['cloze:c', 'recall:a', 'recall:b', 'cloze:a', 'recall:c']);
    expect(q.misses).toEqual({ a: 1 });
    expect(q.done).toBe(0);
  });
  it('is done after every item is right', () => {
    let q = buildQueue([{ id: 'a', hasCloze: false }]);
    q = answerItem(q, false);
    expect(currentItem(q)?.phraseId).toBe('a');
    q = answerItem(q, true);
    expect(isQueueDone(q)).toBe(true);
    expect(answerItem(q, true)).toBe(q);
  });
});

describe('shuffle and rounds', () => {
  it('shuffles with the given random source and keeps every item', () => {
    const out = shuffle([1, 2, 3, 4], () => 0);
    expect(out).toEqual([2, 3, 4, 1]);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
  });
  it('makes rounds of 6 and joins a short last round', () => {
    expect(matchingRounds([...Array(12).keys()]).map((r) => r.length)).toEqual([6, 6]);
    expect(matchingRounds([...Array(8).keys()]).map((r) => r.length)).toEqual([8]);
    expect(matchingRounds([...Array(10).keys()]).map((r) => r.length)).toEqual([6, 4]);
    expect(matchingRounds([])).toEqual([]);
  });
});

describe('phrase stage', () => {
  it('only goes up', () => {
    expect(raiseStage(undefined, 'recognized')).toBe('recognized');
    expect(raiseStage('recalled', 'recognized')).toBe('recalled');
    expect(stageAtLeast('prompted', 'recalled')).toBe(true);
    expect(stageAtLeast(undefined, 'recognized')).toBe(false);
    expect(progressId('t1', 'p3')).toBe('t1__p3');
  });
  it('summarizes sets and skips removed phrases', () => {
    const p = (id: string, setIndex: number, removed = false): TalkPhrase => ({ id, text: id, ipa: '', meaning: '', example: '', setIndex, removed });
    const prog = new Map<string, TalkPhraseProgress>([
      ['a', { topicId: 't', phraseId: 'a', text: 'a', stage: 'recalled', usedCount: 0, updatedAt: 0 }],
      ['b', { topicId: 't', phraseId: 'b', text: 'b', stage: 'recognized', usedCount: 0, updatedAt: 0 }],
    ]);
    expect(summarizeSets([p('a', 0), p('b', 0), p('c', 1, true), p('d', 1)], prog)).toEqual([
      { setIndex: 0, total: 2, learned: 1 },
      { setIndex: 1, total: 1, learned: 0 },
    ]);
  });
});
