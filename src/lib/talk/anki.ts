// noda - Talk: phrases as an Anki cards file, in the format the anki-import
// skill reads (header, example with the phrase in bold, definition). Pure.

import type { TalkPhrase, TalkPhraseProgress } from './types';

/** Puts the phrase in bold inside its example (first match, any case). */
function boldIn(example: string, phrase: string): string {
  const at = example.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return example;
  return `${example.slice(0, at)}**${example.slice(at, at + phrase.length)}**${example.slice(at + phrase.length)}`;
}

/** Cards for the live phrases you do not own yet (not Active). Empty string when none. */
export function phrasesToAnki(phrases: TalkPhrase[], progress: Map<string, TalkPhraseProgress>, level: string, topicTitle: string): string {
  return phrases
    .filter((p) => !p.removed && progress.get(p.id)?.stage !== 'active')
    .map((p, i) =>
      [`${i + 1}. ${p.text}`, boldIn(p.example || p.text, p.text), `[Phrase - ${level}] ${p.meaning}`, `Topic: ${topicTitle}`].join('\n'),
    )
    .join('\n\n');
}

/** A safe file name: lowercase words joined by dashes. */
export function ankiFileName(topicTitle: string, setIndex: number): string {
  const slug = topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic';
  return `noda-talk-${slug}-set${setIndex + 1}.txt`;
}
