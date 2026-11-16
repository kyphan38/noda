import { describe, expect, it } from 'vitest';
import type { Sentence } from '@/types';
import { findActiveTranscriptIndex, findDictationScrollIndex } from './transcript-scroll';

const s = (id: number, start: number, end: number) => ({ id, start, end, text: `s${id}` }) as Sentence;
const tr = [s(1, 0, 2), s(2, 3, 5), s(3, 5, 8)];

describe('findActiveTranscriptIndex', () => {
  it('finds the sentence playing, or the next one in a gap', () => {
    expect(findActiveTranscriptIndex(1, tr)).toBe(0);
    expect(findActiveTranscriptIndex(2.5, tr)).toBe(1);
    expect(findActiveTranscriptIndex(5, tr)).toBe(2);
    expect(findActiveTranscriptIndex(99, tr)).toBe(2);
    expect(findActiveTranscriptIndex(1, [])).toBe(-1);
  });
});

describe('findDictationScrollIndex', () => {
  it('stays on the playing sentence while it is not done', () => {
    expect(findDictationScrollIndex(tr, 4, {})).toBe(1);
  });
  it('jumps to the first sentence not done when the playing one is done', () => {
    expect(findDictationScrollIndex(tr, 4, { 2: true })).toBe(0);
    expect(findDictationScrollIndex(tr, 1, { 1: true, 2: true })).toBe(2);
  });
  it('follows playback once everything is done', () => {
    expect(findDictationScrollIndex(tr, 6, { 1: true, 2: true, 3: true })).toBe(2);
  });
});
