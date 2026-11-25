import { describe, expect, it } from 'vitest';
import { clozeChange, clozeFill, clozeMask, personalWords } from './cloze';
import { alignDictationInput, normalizeDictationTarget } from './utils';

const T = normalizeDictationTarget("I'm going to the station at 5, and it's cold.");
// im going to the station at 5 and its cold
const M = clozeMask(T);

describe('clozeMask', () => {
  it('hides weak words, contractions and numbers', () => {
    const hidden = T.split(' ').filter((_, i) => M[i]);
    expect(hidden).toEqual(['im', 'to', 'the', 'at', '5', 'and', 'its']);
  });

  it('hides the longest word when none is weak', () => {
    const t = normalizeDictationTarget('Engineers love tunnels');
    expect(clozeMask(t)).toEqual([true, false, false]);
  });

  it('also hides your own hard words', () => {
    const t = normalizeDictationTarget('Engineers love tunnels');
    expect(clozeMask(t, new Set(['tunnels']))).toEqual([false, false, true]);
  });

  it('is empty for an empty line', () => {
    expect(clozeMask('')).toEqual([]);
  });
});

describe('clozeFill', () => {
  const t = normalizeDictationTarget('Trains run to the city');
  // trains run [to] [the] city
  const m = clozeMask(t);

  it('fills the shown words at the start and stops on the first hidden one', () => {
    expect(clozeFill('', t, m)).toBe('trains run ');
  });

  it('fills the shown words after a finished hidden word, to the end', () => {
    expect(clozeFill(alignDictationInput('trainsruntothe', t), t, m)).toBe('trains run to the city');
  });

  it('leaves a half-typed hidden word alone', () => {
    expect(clozeFill('trains run t', t, m)).toBe('trains run t');
  });
});

describe('clozeChange', () => {
  const t = normalizeDictationTarget('A big cat sat on the mat');
  // [a] big cat sat [on] [the] mat
  const m = clozeMask(t);

  it('fills on after typing a hidden word', () => {
    expect(clozeChange('', 'a', t, m)).toBe('a big cat sat ');
  });

  it('typing on goes through the hidden words and fills the end', () => {
    expect(clozeChange('a big cat sat ', 'a big cat sat onthe', t, m)).toBe('a big cat sat on the mat');
  });

  it('a backspace into shown words takes the last letter of the hidden word before', () => {
    expect(clozeChange('a big cat sat ', 'a big cat sa', t, m)).toBe('');
    const prev = 'a big cat sat on ';
    expect(clozeChange(prev, 'a big cat sat o', t, m)).toBe('a big cat sat o');
  });

  it('a backspace that only takes the space after shown words takes the hidden letter before', () => {
    // "x" (wrong for "a") filled "big cat sat "; one backspace must take the x away.
    expect(clozeChange('x big cat sat ', 'x big cat sat', t, m)).toBe('');
    // After a hidden word the space is just a space.
    expect(clozeChange('a big cat sat on ', 'a big cat sat on', t, m)).toBe('a big cat sat on');
  });

  it('puts letters that come at once only into the gaps', () => {
    expect(clozeChange('', 'aonthe', t, m)).toBe('a big cat sat on the mat');
    expect(clozeChange('a big cat sat ', 'a big cat sat on', t, m)).toBe('a big cat sat on');
  });

  it('keeps wrong letters, so they can be fixed', () => {
    expect(clozeChange('a big cat sat ', 'a big cat sat ix', t, m)).toBe('a big cat sat ix');
  });
});

describe('personalWords', () => {
  it('keeps words missed at least twice', () => {
    expect([...personalWords({ tunnel: 2, rock: 1, mile: 5 })].sort()).toEqual(['mile', 'tunnel']);
  });
});
