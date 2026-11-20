import { describe, expect, it } from 'vitest';
import { phraseGoal, rateTalk } from './rating';
import type { TalkFix, TalkSession, TalkTurn } from './types';

const fix = (kind: TalkFix['kind']): TalkFix => ({ kind, wrong: 'a', right: 'b', why: '', pattern: 'other' });
const turn = (transcript: string, fixes: TalkFix[] = [], used: string[] = [], dismissedFixes: number[] = []): TalkTurn => ({
  ai: { text: '', curveball: false },
  transcript,
  seconds: 5,
  review: { correct: '', natural: '', levelUp: '', fixes },
  usedPhraseIds: used,
  dismissedFixes,
});
const session = (turns: TalkTurn[], level: TalkSession['level'] = 'B2'): TalkSession => ({
  id: 's',
  topicId: 't',
  setIndex: 0,
  scenarioId: 's0',
  level,
  mode: 'instant',
  selfRepair: true,
  turns,
  startedAt: 0,
});
const twelve = 'one two three four five six seven eight nine ten eleven twelve';

describe('phraseGoal', () => {
  it('grows with level and never passes the set size', () => {
    expect([phraseGoal('B1', 10), phraseGoal('B2', 10), phraseGoal('C1', 10), phraseGoal('C1', 3)]).toEqual([2, 3, 4, 3]);
  });
});

describe('rateTalk', () => {
  it('rates a clean, full, phrase-rich talk as strong', () => {
    const r = rateTalk(session([turn(twelve, [], ['p0', 'p1']), turn(twelve, [fix('natural')], ['p2'])]), 10);
    expect(r.map((x) => x.grade)).toEqual([3, 3, 3]);
    expect(r[0].detail).toBe('0 mistakes per answer');
    expect(r[2].detail).toBe('3 of 3 set phrases');
  });
  it('counts only real mistakes, not dismissed ones', () => {
    const r = rateTalk(session([turn(twelve, [fix('grammar'), fix('word')], [], [1]), turn(twelve, [fix('vietlish'), fix('tone')])]), 10);
    expect(r[0]).toEqual({ name: 'Accuracy', grade: 2, detail: '1 mistake per answer' });
  });
  it('marks short, hesitant answers and few phrases for practice', () => {
    const r = rateTalk(session([turn('um uh yes uh fine'), turn('uh no um')]), 10);
    expect(r[1].grade).toBe(1);
    expect(r[1].detail).toBe('4 words per answer, 2.5 uh/um');
    expect(r[2].grade).toBe(1);
  });
});
