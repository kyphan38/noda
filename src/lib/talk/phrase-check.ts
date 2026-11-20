// noda - Talk: fill-in-the-blank sentences and answer checks for the Learn step. Pure.

import { checkParagraph } from '@/lib/paragraph-dictation';
import { normalizeDictationTarget } from '@/lib/utils';

export type Cloze = { before: string; after: string; answer: string };

const norm = (s: string) => normalizeDictationTarget(s.replace(/[‘’]/g, "'")).trim();

/**
 * The example sentence with the phrase cut out. Case-insensitive. Null when the
 * phrase is not in the sentence word for word (the drill then skips the blank).
 */
export function makeCloze(example: string, phrase: string): Cloze | null {
  const p = phrase.trim();
  if (!p) return null;
  const at = example.toLowerCase().indexOf(p.toLowerCase());
  if (at < 0) return null;
  return { before: example.slice(0, at), after: example.slice(at + p.length), answer: example.slice(at, at + p.length) };
}

/** A typed answer is right when it matches the phrase, ignoring case and punctuation. */
export function isPhraseTyped(answer: string, phrase: string): boolean {
  const a = norm(answer);
  return a.length > 0 && a === norm(phrase);
}

/** A spoken answer is right when every word of the phrase is heard, in order. */
export function isPhraseSpoken(transcript: string, phrase: string): boolean {
  const r = checkParagraph(transcript, phrase);
  return r.total > 0 && r.right === r.total;
}

/** "push a hotfix" -> "p___ a h_____": first letters only, for the blank's hint. */
export function phraseHint(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 1 ? w : w[0] + w.slice(1).replace(/[\p{L}\p{N}]/gu, '_')))
    .join(' ');
}
