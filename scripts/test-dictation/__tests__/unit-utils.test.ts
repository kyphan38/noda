import { describe, it, expect } from 'vitest';
import {
  normalizeDictationTarget,
  alignDictationInput,
} from '../../../lib/utils';

const target1 = 'the cat sat on the mat';
const target2 = 'who run switzerlands trains';

describe('normalizeDictationTarget', () => {
  it('0a. Lowercase conversion', () => {
    expect(normalizeDictationTarget('The Cat SAT')).toBe('the cat sat');
  });

  it('0b. Punctuation stripped', () => {
    expect(normalizeDictationTarget('hello, world!')).toBe('hello world');
  });

  it('0c. Apostrophe stripped', () => {
    expect(normalizeDictationTarget("he drink's cold water")).toBe('he drinks cold water');
  });

  it('0d. Unicode modifier letter U+02BC stripped', () => {
    expect(normalizeDictationTarget('Switzerlandʼs trains')).toBe('switzerlands trains');
  });

  it('0e. Whitespace collapsed', () => {
    expect(normalizeDictationTarget('  the   cat  ')).toBe('the cat');
  });

  it('0f. Empty string', () => {
    expect(normalizeDictationTarget('')).toBe('');
  });

  it('0g. Only whitespace', () => {
    expect(normalizeDictationTarget('   ')).toBe('');
  });

  it('0h. Numbers preserved', () => {
    expect(normalizeDictationTarget('123 abc')).toBe('123 abc');
  });

  it('0i. Trailing space stripped by default', () => {
    expect(normalizeDictationTarget('hello ')).toBe('hello');
  });

  it('0j. preserveTrailingSpace keeps trailing space', () => {
    expect(normalizeDictationTarget('hello ', { preserveTrailingSpace: true })).toBe('hello ');
  });

  it('0k. preserveTrailingSpace no-op when no trailing space', () => {
    expect(normalizeDictationTarget('hello', { preserveTrailingSpace: true })).toBe('hello');
  });

  it('0l. Leading whitespace stripped', () => {
    expect(normalizeDictationTarget('  hello')).toBe('hello');
  });

  it('0m. Tabs and newlines treated as spaces', () => {
    expect(normalizeDictationTarget('the\tcat\nsat')).toBe('the cat sat');
  });

  it('0n. Only punctuation returns empty', () => {
    expect(normalizeDictationTarget('...!!!???')).toBe('');
  });

  it('0o. Mixed punctuation and letters', () => {
    expect(normalizeDictationTarget("it's a (test), right?")).toBe('its a test right');
  });
});

describe('alignDictationInput', () => {
  it('0p. Basic alignment with auto-space', () => {
    expect(alignDictationInput('thec', target1)).toBe('the c');
  });

  it('0q. Full alignment no spaces typed', () => {
    expect(alignDictationInput('thecatsatonthemat', target1)).toBe('the cat sat on the mat');
  });

  it('0r. Empty input returns empty', () => {
    expect(alignDictationInput('', target1)).toBe('');
  });

  it('0s. Overflow clamped to target length', () => {
    expect(alignDictationInput('thecatsatonthematxxx', target1)).toBe('the cat sat on the mat');
  });

  it('0t. Case insensitive alignment', () => {
    expect(alignDictationInput('THEC', target1)).toBe('the c');
  });

  it('0u. Punctuation in input stripped', () => {
    expect(alignDictationInput('the.c', target1)).toBe('the c');
  });

  it('0v. Input with explicit spaces aligned', () => {
    expect(alignDictationInput('the cat', target1)).toBe('the cat');
  });

  it('0w. Double spaces in input collapsed', () => {
    expect(alignDictationInput('the  cat', target1)).toBe('the cat');
  });

  it('0x. Trailing space at word boundary preserved', () => {
    expect(alignDictationInput('the ', target1)).toBe('the ');
  });

  it('0y. Trailing space NOT at word boundary is not added', () => {
    expect(alignDictationInput('thec ', target1)).toBe('the c');
  });

  it('0z. Trailing space at second boundary', () => {
    expect(alignDictationInput('the cat ', target1)).toBe('the cat ');
  });

  it('0aa. Trailing space after full match not added', () => {
    expect(alignDictationInput('thecatsatonthemat ', target1)).toBe('the cat sat on the mat');
  });

  it('0ab. Multiple words with trailing space', () => {
    expect(alignDictationInput('who run ', target2)).toBe('who run ');
  });

  it('0ac. Partial word then space (not at boundary)', () => {
    expect(alignDictationInput('wh ', target2)).toBe('wh');
  });

  it('0ad. Letters in = letters out (no space typed)', () => {
    const input = 'thecat';
    const result = alignDictationInput(input, target1);
    expect(result.replace(/ /g, '')).toBe(input.replace(/ /g, ''));
  });

  it('0ae. Letters in = letters out (spaces typed)', () => {
    const input = 'the cat sat';
    const result = alignDictationInput(input, target1);
    const inLetters = normalizeDictationTarget(input).replace(/ /g, '');
    expect(result.replace(/ /g, '')).toBe(inLetters);
  });

  it('0af. Single-word target (no spaces)', () => {
    expect(alignDictationInput('hel', 'hello')).toBe('hel');
  });

  it('0ag. Single-word target full match', () => {
    expect(alignDictationInput('hello', 'hello')).toBe('hello');
  });

  it('0ah. Single char input', () => {
    expect(alignDictationInput('t', target1)).toBe('t');
  });

  it('0ai. Completion detection: letters match', () => {
    const result = alignDictationInput('thecatsatonthemat', target1);
    expect(result.replace(/ /g, '')).toBe(target1.replace(/ /g, ''));
  });

  it('0aj. Completion detection: letters match with explicit spaces', () => {
    const result = alignDictationInput('the cat sat on the mat', target1);
    expect(result.replace(/ /g, '')).toBe(target1.replace(/ /g, ''));
  });

  it('0ak. Unicode target completion', () => {
    const target = normalizeDictationTarget('Switzerlandʼs trains');
    const result = alignDictationInput('switzerlandstrains', target);
    expect(result.replace(/ /g, '')).toBe(target.replace(/ /g, ''));
  });
});
