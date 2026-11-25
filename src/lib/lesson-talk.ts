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

/** Keep in sync with MAX_LESSON_NOTES and MAX_TARGETS in functions/src/lib/talkTopic.ts. */
export const LESSON_NOTES_MAX = 4000;
export const LESSON_TARGETS_MAX = 12;

type Miss = { sentenceId: number; n: number; text: string };

/** Talk topic id for a lesson: one topic per lesson, so opening it again is free. */
export function lessonTopicId(lessonId: string): string {
  return `lesson-${lessonId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 80);
}

/**
 * What a lesson topic is built from:
 * - notes: the stretch of the transcript, at most `max` chars, with the most dictation misses
 *   (weighted by count). With no misses, the start of the lesson.
 * - targets: the missed sentences, most misses first.
 */
export function buildLessonNotes(
  sentences: readonly (Line & { id: number })[],
  misses: readonly Miss[],
  max = LESSON_NOTES_MAX,
): { notes: string; targets: string[] } {
  const lines = sentences
    .map((s) => ({ id: s.id, text: s.text.replace(/\s+/g, ' ').trim().slice(0, max) }))
    .filter((s) => s.text);
  const weight = new Map(misses.filter((m) => m.n > 0).map((m) => [m.sentenceId, m.n]));

  // Sliding window over whole sentences: the one with the most misses wins, the earliest on a tie.
  let best = { from: 0, to: 0, score: -1 };
  let to = 0;
  let len = -1;
  let score = 0;
  for (let from = 0; from < lines.length; from++) {
    while (to < lines.length && len + 1 + lines[to].text.length <= max) {
      len += 1 + lines[to].text.length;
      score += weight.get(lines[to].id) ?? 0;
      to++;
    }
    if (score > best.score) best = { from, to, score };
    if (to === lines.length) break;
    len -= lines[from].text.length + 1;
    score -= weight.get(lines[from].id) ?? 0;
  }
  const notes = lines
    .slice(best.from, best.to)
    .map((s) => s.text)
    .join(' ');

  const targets = [...misses]
    .filter((m) => m.n > 0 && m.text.trim())
    .sort((a, b) => b.n - a.n || a.sentenceId - b.sentenceId)
    .map((m) => m.text.replace(/\s+/g, ' ').trim())
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, LESSON_TARGETS_MAX);
  return { notes, targets };
}
