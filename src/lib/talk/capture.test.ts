import { describe, expect, it } from 'vitest';
import { capturesToNotes, cleanCapture, MAX_CAPTURE_CHARS, recentCaptures } from './capture';

describe('capture', () => {
  it('keeps one trimmed line, capped', () => {
    expect(cleanCapture('  this is blocked \n by the other team ')).toBe('this is blocked by the other team');
    expect(cleanCapture('   ')).toBe('');
    expect(cleanCapture('x'.repeat(400))).toHaveLength(MAX_CAPTURE_CHARS);
  });
  it('numbers the unused lines, oldest first', () => {
    const rows = [
      { id: 'b', text: 'second', createdAt: 2 },
      { id: 'a', text: 'first', createdAt: 1 },
      { id: 'c', text: 'done', createdAt: 3, usedInTopicId: 't' },
    ];
    expect(capturesToNotes(rows)).toBe('1. first\n2. second');
  });
  it('lists newest first', () => {
    const rows = [1, 3, 2].map((createdAt) => ({ id: String(createdAt), text: 't', createdAt }));
    expect(recentCaptures(rows, 2).map((r) => r.id)).toEqual(['3', '2']);
  });
});
