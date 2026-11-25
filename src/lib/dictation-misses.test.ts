import { describe, expect, it } from 'vitest';
import { newWrongLetters, topMisses, wordAtLetter, wrongWordsInChange, type MissDoc } from './dictation-misses';

describe('newWrongLetters', () => {
  const target = 'hello world';
  it('counts wrong letters typed past the old input', () => {
    expect(newWrongLetters('', 'h', target)).toBe(0);
    expect(newWrongLetters('h', 'hx', target)).toBe(1);
    expect(newWrongLetters('he', 'hexxo w', target)).toBe(2);
  });
  it('counts nothing for deleting or for the same length', () => {
    expect(newWrongLetters('hex', 'he', target)).toBe(0);
    expect(newWrongLetters('hex', 'hel', target)).toBe(0);
  });
  it('ignores spaces', () => {
    expect(newWrongLetters('hello', 'hello w', target)).toBe(0);
  });
});

describe('topMisses', () => {
  const docs: MissDoc[] = [
    { lessonId: 'a', lessonName: 'A', items: { '1': { n: 3, text: 'one', start: 0, end: 1, at: 10 }, '2': { n: 5, text: 'two', start: 1, end: 2, at: 5 } } },
    { lessonId: 'b', lessonName: 'B', items: { '7': { n: 3, text: 'seven', start: 0, end: 1, at: 20 }, '8': { n: 0, text: 'x', start: 0, end: 1, at: 1 } } },
  ];
  it('sorts by misses, then the latest', () => {
    expect(topMisses(docs, null, 10).map((r) => `${r.lessonId}${r.sentenceId}`)).toEqual(['a2', 'b7', 'a1']);
  });
  it('leaves out lessons not live and caps the list', () => {
    expect(topMisses(docs, new Set(['a']), 1).map((r) => r.sentenceId)).toEqual([2]);
  });
});

describe('wordAtLetter and wrongWordsInChange', () => {
  const t = 'the cat sat';
  it('finds the word of a letter', () => {
    expect(wordAtLetter(t, 0)).toBe('the');
    expect(wordAtLetter(t, 3)).toBe('cat');
    expect(wordAtLetter(t, 8)).toBe('sat');
    expect(wordAtLetter(t, 9)).toBeNull();
  });
  it('lists each word with a new wrong letter once', () => {
    expect(wrongWordsInChange('the', 'the kxt', t)).toEqual(['cat']);
    expect(wrongWordsInChange('', 'thx kat s', t)).toEqual(['the', 'cat']);
    expect(wrongWordsInChange('the cxt', 'the cx', t)).toEqual([]);
  });
});
