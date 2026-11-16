// noda - Paragraph dictation (N7): sentences in groups, and a word check. Pure.

import { normalizeDictationTarget } from '@/lib/utils';

export const PARAGRAPH_SIZE = 5;
/** A short last group joins the one before it. */
const MIN_LAST = 3;

/** Sentences in groups of about PARAGRAPH_SIZE, in order. */
export function groupParagraphs<T>(sentences: T[], size = PARAGRAPH_SIZE): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < sentences.length; i += size) groups.push(sentences.slice(i, i + size));
  if (groups.length > 1 && groups[groups.length - 1].length < MIN_LAST) {
    const last = groups.pop()!;
    groups[groups.length - 1].push(...last);
  }
  return groups;
}

export type WordMark = { word: string; ok: boolean };
export type ParagraphCheck = { marks: WordMark[]; right: number; total: number; extra: number; percent: number };

const words = (s: string) => normalizeDictationTarget(s).split(' ').filter(Boolean);

/**
 * Which words of the target were written (in order), by the longest common
 * subsequence of words. `extra` counts typed words that match nothing.
 * `marks` keep the target's own spelling for display.
 */
export function checkParagraph(typed: string, target: string): ParagraphCheck {
  const shown = target.split(/\s+/).filter(Boolean);
  const t = words(target);
  const u = words(typed);
  // Word lists line up with `shown` only when normalizing keeps the word count; fall back to t.
  const display = shown.length === t.length ? shown : t;
  const n = t.length;
  const m = u.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = t[i] === u[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (t[i] === u[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const right = dp[0][0];
  return {
    marks: display.map((word, k) => ({ word, ok: ok[k] })),
    right,
    total: n,
    extra: m - right,
    percent: n === 0 ? 0 : Math.round((100 * right) / n),
  };
}
