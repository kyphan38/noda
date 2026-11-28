import { describe, expect, it } from 'vitest';
import {
  TRANSLATION_VERSION,
  canTranslate,
  pickTargetIndex,
  pickTranslateBatch,
  resolveTargetIndex,
  translationLines,
  usableTranslations,
} from './translate';
import type { Sentence } from '@/types';

const lines = (n: number): Sentence[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, text: ` Line  ${i + 1}. `, start: i * 2, end: i * 2 + 1.5 }));

describe('pickTargetIndex', () => {
  const t = lines(3);
  it('returns the sentence playing', () => {
    expect(pickTargetIndex(t, 2.2)).toBe(1);
  });
  it('keeps the sentence just heard during the gap after it', () => {
    expect(pickTargetIndex(t, 1.7)).toBe(0);
  });
  it('returns -1 before the first sentence', () => {
    expect(pickTargetIndex([{ id: 1, text: 'a', start: 1, end: 2 }], 0.5)).toBe(-1);
  });
});

describe('canTranslate', () => {
  it('always in Listen and Shadowing, in Dictation only after the line is done', () => {
    expect(canTranslate('listen', false)).toBe(true);
    expect(canTranslate('shadowing', false)).toBe(true);
    expect(canTranslate('dictation', false)).toBe(false);
    expect(canTranslate('dictation', true)).toBe(true);
  });
});

describe('pickTranslateBatch', () => {
  it('takes the asked sentence and the next ones, with two lines of context', () => {
    const b = pickTranslateBatch(lines(30), 5, new Set(), new Set(), 4);
    expect(b?.items.map((i) => i.id)).toEqual([6, 7, 8, 9]);
    expect(b?.items[0].text).toBe('Line 6.');
    expect(b?.context).toEqual(['Line 4.', 'Line 5.']);
  });

  it('skips sentences already translated or on the way', () => {
    const b = pickTranslateBatch(lines(10), 0, new Set([2]), new Set([3]), 3);
    expect(b?.items.map((i) => i.id)).toEqual([1, 4, 5]);
  });

  it('needs no call when the asked sentence is known or pending', () => {
    expect(pickTranslateBatch(lines(5), 1, new Set([2]), new Set())).toBeNull();
    expect(pickTranslateBatch(lines(5), 1, new Set(), new Set([2]))).toBeNull();
    expect(pickTranslateBatch(lines(5), 9, new Set(), new Set())).toBeNull();
  });

  it('stops at the end of the lesson', () => {
    expect(pickTranslateBatch(lines(3), 1, new Set(), new Set())?.items).toHaveLength(2);
  });
});

describe('usableTranslations', () => {
  it('keeps docs whose text and version match the lesson', () => {
    const t = lines(3);
    const docs = [
      { id: '1', data: { en: 'Line 1.', vi: 'Dòng 1.', version: TRANSLATION_VERSION } },
      { id: '2', data: { en: 'Edited line.', vi: 'Dòng 2.', version: TRANSLATION_VERSION } },
      { id: '3', data: { en: 'Line 3.', vi: 'Dòng 3.', version: 0 } },
      { id: '9', data: { en: 'Line 9.', vi: 'Dòng 9.', version: TRANSLATION_VERSION } },
    ];
    expect([...usableTranslations(docs, t)]).toEqual([[1, 'Dòng 1.']]);
  });
});

describe('translationLines', () => {
  it('shows ready, error or loading for each opened row', () => {
    const lines = translationLines(new Set([1, 2, 3]), new Map([[1, 'Một']]), new Map([[2, 'Failed']]), 'listen', {});
    expect(lines.get(1)).toEqual({ status: 'ready', vi: 'Một' });
    expect(lines.get(2)).toEqual({ status: 'error', message: 'Failed' });
    expect(lines.get(3)).toEqual({ status: 'loading' });
  });

  it('hides rows not done in Dictation', () => {
    const lines = translationLines(new Set([1, 2]), new Map([[1, 'Một'], [2, 'Hai']]), new Map(), 'dictation', { 2: true });
    expect([...lines.keys()]).toEqual([2]);
  });
});

describe('resolveTargetIndex', () => {
  const t = lines(3);
  it('prefers the sentence playing', () => {
    expect(resolveTargetIndex(t, 2.2, 3)).toBe(1);
  });
  it('uses the chosen sentence in the pre-roll gap before it', () => {
    expect(resolveTargetIndex(t, 3.9, 3)).toBe(2);
  });
  it('falls back to the time when nothing was chosen', () => {
    expect(resolveTargetIndex(t, 1.7, null)).toBe(0);
    expect(resolveTargetIndex(t, 1.7, 99)).toBe(0);
  });
});
