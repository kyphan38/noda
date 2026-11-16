import { describe, expect, it } from 'vitest';
import { listenPauseMs } from './listen-pause';

describe('listenPauseMs', () => {
  it('is the sentence length plus one second', () => {
    expect(listenPauseMs({ start: 10, end: 12.5 })).toBe(3500);
  });
  it('caps long sentences and never goes below the extra second', () => {
    expect(listenPauseMs({ start: 0, end: 60 })).toBe(15000);
    expect(listenPauseMs({ start: 5, end: 5 })).toBe(1000);
  });
});
