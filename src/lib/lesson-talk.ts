// noda - Lesson -> Talk: pick lesson text for a spoken retell. Pure: no React, no Firebase.

/** Same as MAX_SOURCE in functions/src/lib/talkSpeech.ts. */
export const RETELL_MAX_CHARS = 4000;

type Line = { text: string; start: number; end: number };

/** One stretch of the lesson to retell: its text and where it sits in the media. */
export type RetellPart = { text: string; start: number; end: number };

/** How many parts filling each one up to `max` needs: the fewest possible. */
function fewestParts(lines: readonly Line[], max: number): number {
  let parts = 0;
  let len = -1;
  for (const s of lines) {
    if (len < 0 || len + 1 + s.text.length > max) {
      parts++;
      len = s.text.length;
    } else len += 1 + s.text.length;
  }
  return parts;
}

/**
 * Cuts the transcript into parts at sentence ends, each at most `max` chars.
 * Uses the fewest parts, of about the same size, so a long lesson never ends
 * with a tiny last part. A sentence longer than `max` is cut short.
 */
export function retellParts(sentences: readonly Line[], max = RETELL_MAX_CHARS): RetellPart[] {
  const lines = sentences
    .map((s) => ({ text: s.text.replace(/\s+/g, ' ').trim().slice(0, max), start: s.start, end: s.end }))
    .filter((s) => s.text);
  if (lines.length === 0) return [];

  let partsLeft = fewestParts(lines, max);
  let charsLeft = lines.reduce((n, s) => n + s.text.length + 1, 0);
  let target = charsLeft / partsLeft;
  const parts: RetellPart[] = [];
  let cur: RetellPart | null = null;
  for (const s of lines) {
    if (cur) {
      const joined = cur.text.length + 1 + s.text.length;
      // Stop here when one more sentence would not fit, or would move further from the target.
      if (joined > max || (partsLeft > 1 && Math.abs(joined - target) > Math.abs(cur.text.length - target))) {
        parts.push(cur);
        charsLeft -= cur.text.length + 1;
        partsLeft = Math.max(1, partsLeft - 1);
        target = charsLeft / partsLeft;
        cur = null;
      }
    }
    cur = cur ? { text: `${cur.text} ${s.text}`, start: cur.start, end: s.end } : { ...s };
  }
  if (cur) parts.push(cur);
  return parts;
}
