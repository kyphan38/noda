import { describe, expect, it } from 'vitest';
import { checkParagraph, groupParagraphs } from './paragraph-dictation';

describe('groupParagraphs', () => {
  it('makes groups of 5 and joins a short last group', () => {
    expect(groupParagraphs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map((g) => g.length)).toEqual([5, 7]);
    expect(groupParagraphs([1, 2, 3, 4, 5, 6, 7, 8]).map((g) => g.length)).toEqual([5, 3]);
    expect(groupParagraphs([1, 2]).map((g) => g.length)).toEqual([2]);
    expect(groupParagraphs([])).toEqual([]);
  });
});

describe('checkParagraph', () => {
  it('marks the words written in order, ignoring case and punctuation', () => {
    const r = checkParagraph('the cat sat on mat', 'The cat sat on the mat.');
    expect(r.marks.map((m) => m.ok)).toEqual([true, true, true, true, false, true]);
    expect(r.right).toBe(5);
    expect(r.total).toBe(6);
    expect(r.percent).toBe(83);
    expect(r.extra).toBe(0);
    expect(r.marks[5].word).toBe('mat.');
  });
  it('counts extra words and handles empty input', () => {
    expect(checkParagraph('a big dog', 'a dog').extra).toBe(1);
    expect(checkParagraph('', 'a dog').percent).toBe(0);
  });
});
