import { describe, expect, it } from 'vitest';
import { parseItemFromSearch, pickLatestLessonId } from '../../../src/lib/item-url';

describe('parseItemFromSearch', () => {
  it('reads ?open=latest', () => {
    expect(parseItemFromSearch('?open=latest')).toEqual({ kind: 'latest' });
  });

  it('still reads a lesson link', () => {
    expect(parseItemFromSearch('?lesson=a&id=x1')).toEqual({ kind: 'lesson', id: 'x1' });
  });
});

describe('pickLatestLessonId', () => {
  it('skips trashed and missing lessons', () => {
    const rows = [{ id: 'a', isTrashed: true }, { id: 'b' }];
    expect(pickLatestLessonId(['gone', 'a', 'b'], rows)).toBe('b');
  });

  it('returns null with no lessons', () => {
    expect(pickLatestLessonId([], [])).toBeNull();
  });
});
