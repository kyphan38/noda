import { describe, expect, it } from 'vitest';
import {
  MAX_BATCH,
  TRANSLATION_VERSION,
  buildTranslatePrompt,
  checkTranslateRequest,
  parseTranslations,
  usableCache,
} from '../../functions/src/lib/translate';

const base = { lessonId: 'abc_123', title: ' Climate  talk ', items: [{ id: 3, text: '  The  ice is melting. ' }] };

describe('checkTranslateRequest', () => {
  it('cleans texts and keeps at most two context lines', () => {
    const req = checkTranslateRequest({ ...base, context: ['a', 'b', 'c'] });
    expect(req.title).toBe('Climate talk');
    expect(req.items).toEqual([{ id: 3, text: 'The ice is melting.' }]);
    expect(req.context).toEqual(['b', 'c']);
  });

  it('rejects a bad lesson id, an empty list, a too long list and repeated ids', () => {
    expect(() => checkTranslateRequest({ ...base, lessonId: 'a/b' })).toThrow();
    expect(() => checkTranslateRequest({ ...base, items: [] })).toThrow();
    const many = Array.from({ length: MAX_BATCH + 1 }, (_, i) => ({ id: i, text: 'x' }));
    expect(() => checkTranslateRequest({ ...base, items: many })).toThrow();
    expect(() => checkTranslateRequest({ ...base, items: [{ id: 1, text: 'a' }, { id: 1, text: 'b' }] })).toThrow();
    expect(() => checkTranslateRequest({ ...base, items: [{ id: 1, text: '  ' }] })).toThrow();
  });
});

describe('buildTranslatePrompt', () => {
  it('numbers each sentence by id and marks context as not to translate', () => {
    const p = buildTranslatePrompt('Climate', [{ id: 7, text: 'Hello.' }], ['Before.']);
    expect(p).toContain('[7] Hello.');
    expect(p).toContain('context only');
    expect(p).toContain('Lesson title: "Climate"');
  });
});

describe('parseTranslations', () => {
  it('returns translations in the asked order', () => {
    const raw = JSON.stringify({ items: [{ id: 2, vi: 'Hai' }, { id: 1, vi: ' Một ' }] });
    expect(parseTranslations(raw, [1, 2])).toEqual([{ id: 1, vi: 'Một' }, { id: 2, vi: 'Hai' }]);
  });

  it('throws when a sentence is missing or empty', () => {
    expect(() => parseTranslations(JSON.stringify({ items: [{ id: 1, vi: 'Một' }] }), [1, 2])).toThrow();
    expect(() => parseTranslations(JSON.stringify({ items: [{ id: 1, vi: '' }] }), [1])).toThrow();
  });
});

describe('usableCache', () => {
  it('uses a doc only for the same text and version', () => {
    const doc = { en: 'The ice is melting.', vi: 'Băng đang tan.', version: TRANSLATION_VERSION };
    expect(usableCache(doc, 'The ice is melting.')).toBe('Băng đang tan.');
    expect(usableCache(doc, 'The ice melted.')).toBeNull();
    expect(usableCache({ ...doc, version: 0 }, 'The ice is melting.')).toBeNull();
    expect(usableCache(undefined, 'x')).toBeNull();
  });
});
