import { describe, expect, it } from 'vitest';
import { cleanCapture, MAX_CAPTURE_CHARS, recentCaptures } from './capture';

describe('capture', () => {
  it('keeps one trimmed line, capped', () => {
    expect(cleanCapture('  this is blocked \n by the other team ')).toBe('this is blocked by the other team');
    expect(cleanCapture('   ')).toBe('');
    expect(cleanCapture('x'.repeat(400))).toHaveLength(MAX_CAPTURE_CHARS);
  });
  it('lists newest first', () => {
    const rows = [1, 3, 2].map((createdAt) => ({ id: String(createdAt), text: 't', createdAt }));
    expect(recentCaptures(rows, 2).map((r) => r.id)).toEqual(['3', '2']);
  });
});
