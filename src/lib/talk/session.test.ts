import { describe, expect, it } from 'vitest';
import { curveballTurn, fixSegments, hintPhrases, pickScenario, topSessionFixes, wordsPerMinute } from './session';
import type { TalkFix, TalkPhrase, TalkTurn } from './types';

const fix = (wrong: string, kind: TalkFix['kind'] = 'grammar', pattern = 'other'): TalkFix => ({ kind, wrong, right: `${wrong}!`, why: '', pattern });

describe('curveballTurn', () => {
  it('is off at B1 and on the 3rd to 5th reply otherwise', () => {
    expect(curveballTurn('B1')).toBeNull();
    expect(curveballTurn('B2', () => 0)).toBe(2);
    expect(curveballTurn('C1', () => 0.99)).toBe(4);
  });
});

describe('hintPhrases', () => {
  const p = (id: string, text: string, example: string, removed = false): TalkPhrase => ({ id, text, ipa: '', meaning: '', example, setIndex: 0, removed });
  const phrases = [
    p('a', 'wrap up', 'I need to wrap up the refactor.'),
    p('b', 'blocked on', 'I am blocked on the API keys.'),
    p('c', 'ship it', 'We can ship it today.'),
    p('d', 'hidden', 'API keys again', true),
  ];
  it('ranks unused phrases by shared words with the question', () => {
    expect(hintPhrases('Is anything blocking you, like the API keys?', phrases, new Set(), 2).map((x) => x.id)).toEqual(['b', 'a']);
    expect(hintPhrases('Is anything blocking you, like the API keys?', phrases, new Set(['b']), 2).map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('fixSegments', () => {
  it('cuts the transcript around each fix, case-insensitive, skipping dismissed ones', () => {
    const t = 'I am working on backend for many product.';
    expect(fixSegments(t, [fix('many product'), fix('I AM working')])).toEqual([
      { text: 'I am working', fix: 1 },
      { text: ' on backend for ' },
      { text: 'many product', fix: 0 },
      { text: '.' },
    ]);
    expect(fixSegments(t, [fix('many product')], [0])).toEqual([{ text: t }]);
    expect(fixSegments(t, [fix('not there')])).toEqual([{ text: t }]);
  });
  it('does not let two fixes overlap', () => {
    // "b a" only appears across the first fix, so it is not marked.
    expect(fixSegments('a b a b', [fix('a b'), fix('b a')])).toEqual([{ text: 'a b', fix: 0 }, { text: ' a b' }]);
  });
});

describe('topSessionFixes', () => {
  const turn = (fixes: TalkFix[], dismissedFixes: number[] = []): TalkTurn => ({
    ai: { text: '', curveball: false },
    transcript: '',
    seconds: 0,
    review: { correct: '', natural: '', levelUp: '', fixes },
    usedPhraseIds: [],
    dismissedFixes,
  });
  it('puts grammar first, keeps one fix per pattern and skips dismissed', () => {
    const out = topSessionFixes(
      [turn([fix('x', 'natural', 'word_choice'), fix('y', 'grammar', 'plural_s')]), turn([fix('z', 'grammar', 'plural_s'), fix('w', 'vietlish', 'vietlish')], [1])],
      5,
    );
    expect(out.map((f) => `${f.turn}:${f.wrong}`)).toEqual(['0:y', '0:x']);
  });
});

describe('wordsPerMinute', () => {
  it('counts words over seconds and skips unclear', () => {
    expect(wordsPerMinute('one two three [unclear] four', 2)).toBe(120);
    expect(wordsPerMinute('hi', 0)).toBe(0);
  });
});

describe('pickScenario', () => {
  it('avoids the last one when it can', () => {
    const s = [{ id: 's0' }, { id: 's1' }];
    expect(pickScenario(s, 's0', () => 0)?.id).toBe('s1');
    expect(pickScenario([{ id: 's0' }], 's0')?.id).toBe('s0');
    expect(pickScenario([])).toBeNull();
  });
});
