import { describe, it, expect } from 'vitest';
import { buildWrapPrompt, checkWrapRequest, MAX_KNOWN, mergeMemory, parseWrap, WrapShapeError } from '../../../functions/src/lib/talkWrap';

describe('talk memory', () => {
  it('adds new facts last, drops repeats and keeps the newest', () => {
    const old = [
      { fact: 'Has a release on Friday', at: 1 },
      { fact: 'Manager is Linh', at: 1 },
    ];
    expect(mergeMemory(old, ['manager is linh', 'Moving house next month'], 5)).toEqual([
      { fact: 'Has a release on Friday', at: 1 },
      { fact: 'manager is linh', at: 5 },
      { fact: 'Moving house next month', at: 5 },
    ]);
    expect(mergeMemory(old, ['a', 'b', 'c'], 5, 3).map((f) => f.fact)).toEqual(['a', 'b', 'c']);
  });
});

describe('talk wrap request', () => {
  it('keeps valid known phrase keys only, up to the cap', () => {
    const known = [
      { key: 'standup-b2__p3', text: 'wrap up' },
      { key: '../x', text: 'bad' },
      { key: 'standup-b2__p4', text: '' },
      ...Array.from({ length: 50 }, (_, i) => ({ key: `t-b2__p${i}`, text: `p${i}` })),
    ];
    const r = checkWrapRequest({ sessionId: 'standup-b2-abc123', known });
    expect(r.known[0]).toEqual({ key: 'standup-b2__p3', text: 'wrap up' });
    expect(r.known).toHaveLength(MAX_KNOWN);
    expect(() => checkWrapRequest({ sessionId: 'Bad/Id' })).toThrow();
  });
});

describe('talk wrap prompt', () => {
  it('lists turns, only the unused targets and known phrases', () => {
    const p = buildWrapPrompt(
      [{ ai: 'What happened?', you: 'I fix it', natural: 'I fixed it.' }],
      [
        { id: 'p0', text: 'roll back' },
        { id: 'p1', text: 'root cause' },
      ],
      [{ key: 't-b2__p2', text: 'on track' }],
      ['p0'],
    );
    expect(p).toContain('Turn 0\nThem: What happened?\nLearner: I fix it\nNatural: I fixed it.');
    expect(p).toContain('- p1: root cause');
    expect(p).not.toContain('- p0: roll back');
    expect(p).toContain('- t-b2__p2: on track');
  });
});

describe('talk wrap parsing', () => {
  const raw = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      missedChances: [
        { turn: 1, phraseId: 'p1', said: 'the reason', better: 'The root cause was a bad image.' },
        { turn: 9, phraseId: 'p1', said: 'x', better: 'y' },
        { turn: 0, phraseId: 'p9', said: 'x', better: 'y' },
      ],
      swaps: [
        { from: 'very big', to: 'huge', why: 'Shorter and stronger.' },
        { from: 'same', to: 'SAME', why: '' },
      ],
      closingPicks: [
        { turn: 0, idea: 'say you fixed it', target: 'I fixed it.' },
        { turn: 0, idea: 'dupe', target: 'dupe' },
        { turn: 1, idea: 'the reason', target: 'The root cause was a bad image.' },
      ],
      activeKeys: ['t-b2__p2', 't-b2__p2', 'nope'],
      focus: 'Use past tense for things that are done.',
      remember: ['Works on the payment team', '', 'Has a trip to Da Nang next week', 'x', 'y'],
      ...extra,
    });

  it('drops bad turns, ids, duplicates and same-word swaps', () => {
    const w = parseWrap(raw(), 2, ['p0', 'p1'], ['t-b2__p2']);
    expect(w.missedChances).toEqual([{ turn: 1, phraseId: 'p1', said: 'the reason', better: 'The root cause was a bad image.' }]);
    expect(w.swaps).toEqual([{ from: 'very big', to: 'huge', why: 'Shorter and stronger.' }]);
    expect(w.closingPicks.map((p) => p.turn)).toEqual([0, 1]);
    expect(w.activeKeys).toEqual(['t-b2__p2']);
    expect(w.remember).toEqual(['Works on the payment team', 'Has a trip to Da Nang next week', 'x']);
  });
  it('throws a shape error on bad JSON or no closing picks', () => {
    expect(() => parseWrap('nope', 2, [], [])).toThrow(WrapShapeError);
    expect(() => parseWrap(raw({ closingPicks: [] }), 2, [], [])).toThrow(WrapShapeError);
  });
});
