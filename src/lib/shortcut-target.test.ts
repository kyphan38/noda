import { describe, expect, it } from 'vitest';
import { takesTyping } from './shortcut-target';

describe('takesTyping', () => {
  it('blocks shortcuts in text fields', () => {
    expect(takesTyping({ tag: 'INPUT' })).toBe(true);
    expect(takesTyping({ tag: 'textarea' })).toBe(true);
    expect(takesTyping({ tag: 'DIV', editable: true })).toBe(true);
  });

  it('allows shortcuts in a read-only input, like a finished Dictation line', () => {
    expect(takesTyping({ tag: 'INPUT', readOnly: true })).toBe(false);
  });

  it('allows shortcuts on buttons, the page or nothing focused', () => {
    expect(takesTyping({ tag: 'BUTTON' })).toBe(false);
    expect(takesTyping({ tag: 'BODY' })).toBe(false);
    expect(takesTyping(null)).toBe(false);
  });
});
