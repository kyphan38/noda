import { describe, expect, it } from 'vitest';
import { ankiFileName, phrasesToAnki } from './anki';
import type { TalkPhrase, TalkPhraseProgress } from './types';

const p = (id: string, text: string, example: string, removed = false): TalkPhrase => ({ id, text, ipa: '', meaning: `meaning of ${text}`, example, setIndex: 0, removed });

describe('phrasesToAnki', () => {
  it('writes cards with the phrase in bold and skips removed and active phrases', () => {
    const progress = new Map<string, TalkPhraseProgress>([['c', { topicId: 't', phraseId: 'c', text: 'x', stage: 'active', usedCount: 1, updatedAt: 0 }]]);
    const out = phrasesToAnki([p('a', 'wrap up', 'We need to Wrap up today.'), p('b', 'gone', 'x', true), p('c', 'done one', 'y'), p('d', 'ship it', 'No match here.')], progress, 'B2', 'Daily standup');
    expect(out).toBe(
      '1. wrap up\nWe need to **Wrap up** today.\n[Phrase - B2] meaning of wrap up\nTopic: Daily standup\n\n' +
        '2. ship it\nNo match here.\n[Phrase - B2] meaning of ship it\nTopic: Daily standup',
    );
    expect(phrasesToAnki([], new Map(), 'B2', 't')).toBe('');
  });
  it('makes a safe file name', () => {
    expect(ankiFileName('1:1 with your manager', 0)).toBe('noda-talk-1-1-with-your-manager-set1.txt');
    expect(ankiFileName('!!!', 2)).toBe('noda-talk-topic-set3.txt');
  });
});
