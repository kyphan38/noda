import { describe, expect, it } from 'vitest';
import { retellParts } from './lesson-talk';

const line = (text: string, i: number) => ({ text, start: i * 10, end: i * 10 + 9 });
const sizes = (parts: { text: string }[]) => parts.map((p) => p.text.split(' ').length);

describe('retellParts', () => {
  it('keeps a short lesson as one part and cleans the spaces', () => {
    const parts = retellParts([line('Hello  there.', 0), line('\nHow are\nyou?', 1)], 100);
    expect(parts).toEqual([{ text: 'Hello there. How are you?', start: 0, end: 19 }]);
  });

  it('cuts at sentence ends into the fewest parts of about the same size', () => {
    const sentences = Array.from({ length: 10 }, (_, i) => line('x'.repeat(29), i));
    const parts = retellParts(sentences, 100);
    // Filling each part to the limit would give 3, 3, 3, 1.
    expect(sizes(parts)).toEqual([3, 2, 3, 2]);
    expect(parts.every((p) => p.text.length <= 100)).toBe(true);
    expect(parts.map((p) => p.text).join(' ')).toBe(sentences.map((s) => s.text).join(' '));
    expect(parts[0].start).toBe(0);
    expect(parts.at(-1)?.end).toBe(99);
  });

  it('fills a part when that is closer to an even split', () => {
    const sentences = Array.from({ length: 5 }, (_, i) => line('y'.repeat(30), i));
    expect(sizes(retellParts(sentences, 100))).toEqual([3, 2]);
  });

  it('cuts a sentence longer than the limit and drops empty lines', () => {
    const parts = retellParts([line('z'.repeat(150), 0), line('   ', 1)], 100);
    expect(parts).toEqual([{ text: 'z'.repeat(100), start: 0, end: 9 }]);
  });

  it('is empty for an empty transcript', () => {
    expect(retellParts([])).toEqual([]);
  });
});
