// noda - Talk: rules for one conversation (turn count, curveball, hints,
// highlights, the fixes worth showing). Pure.

import type { FixKind, TalkFix, TalkLevel, TalkPhrase, TalkTurn } from './types';

export const TURN_COUNT = 8;
/** Quick talk for a busy day: about 5 minutes. */
export const QUICK_TURN_COUNT = 3;
export const HINT_COUNT = 3;
export const TOP_FIXES = 5;

/** Index of the curveball turn (the 3rd to 5th reply), or null at B1. */
export function curveballTurn(level: TalkLevel, random: () => number = Math.random): number | null {
  if (level === 'B1') return null;
  return 2 + Math.min(2, Math.floor(random() * 3));
}

const STOP = new Set(
  'a an the and or but to of in on at for with from by is are was were be been it this that you your i we our they my me do did does can could would will what how why when about have has had so just some any'.split(' '),
);
const content = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9' ]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

/**
 * Hint, level 1: phrases of the set not used yet, the ones whose example and
 * meaning share the most words with the question first. Free: no model call.
 */
export function hintPhrases(question: string, phrases: TalkPhrase[], used: Set<string>, max = HINT_COUNT): TalkPhrase[] {
  const q = content(question);
  return phrases
    .filter((p) => !p.removed && !used.has(p.id))
    .map((p, i) => {
      let score = 0;
      for (const w of content(`${p.example} ${p.meaning} ${p.text}`)) if (q.has(w)) score++;
      return { p, score, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map((x) => x.p);
}

export type Segment = { text: string; fix?: number };

/** The transcript cut into plain text and the parts each fix points at (first match, no overlap). */
export function fixSegments(transcript: string, fixes: TalkFix[], dismissed: number[] = []): Segment[] {
  const lower = transcript.toLowerCase();
  const spans: { start: number; end: number; fix: number }[] = [];
  fixes.forEach((f, fix) => {
    if (dismissed.includes(fix)) return;
    const needle = f.wrong.toLowerCase();
    let from = 0;
    while (from <= lower.length) {
      const start = lower.indexOf(needle, from);
      if (start < 0) return;
      const end = start + needle.length;
      if (!spans.some((s) => start < s.end && end > s.start)) {
        spans.push({ start, end, fix });
        return;
      }
      from = start + 1;
    }
  });
  spans.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) out.push({ text: transcript.slice(at, s.start) });
    out.push({ text: transcript.slice(s.start, s.end), fix: s.fix });
    at = s.end;
  }
  if (at < transcript.length) out.push({ text: transcript.slice(at) });
  return out;
}

const KIND_ORDER: FixKind[] = ['grammar', 'vietlish', 'word', 'tone', 'natural'];

export type SessionFix = TalkFix & { turn: number; index: number };

/** For Flow Mode's end screen: the most useful fixes of the whole talk, one per pattern. */
export function topSessionFixes(turns: TalkTurn[], max = TOP_FIXES): SessionFix[] {
  const all: SessionFix[] = turns.flatMap((t, turn) =>
    t.review.fixes.map((f, index) => ({ ...f, turn, index })).filter((f) => !(t.dismissedFixes ?? []).includes(f.index)),
  );
  all.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.turn - b.turn);
  const seen = new Set<string>();
  const out: SessionFix[] = [];
  for (const f of all) {
    const key = f.pattern === 'other' ? `other:${f.wrong.toLowerCase()}` : f.pattern;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length === max) break;
  }
  return out;
}

/** Words per minute of speech, rounded; 0 when there is no time. */
export function wordsPerMinute(transcript: string, seconds: number): number {
  const words = transcript.split(/\s+/).filter((w) => w && !/^\[unclear\]$/i.test(w)).length;
  return seconds > 0 ? Math.round((words / seconds) * 60) : 0;
}

/** A situation for the next talk, not the same as last time when there is a choice. */
export function pickScenario<T extends { id: string }>(scenarios: T[], lastId?: string, random: () => number = Math.random): T | null {
  const pool = scenarios.length > 1 ? scenarios.filter((s) => s.id !== lastId) : scenarios;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

const FILLER = /^(uh+|um+|uhm+|erm*|ah+|hmm+|mm+)$/i;

/** "uh", "um" and friends in a transcript. */
export function countFillers(transcript: string): number {
  return transcript
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/gi, ''))
    .filter((w) => FILLER.test(w)).length;
}

/** Natural ways to buy a few seconds instead of "uh". Fixed list: no model call. */
export const STALL_PHRASES = [
  'Let me think for a second.',
  "That's a good question.",
  'How can I put this?',
  'Off the top of my head,',
  "I'd say",
  'Well, it depends.',
  'Give me a moment.',
  'If I remember right,',
];

export type ReplyKind = 'question' | 'share' | 'invite';

/**
 * What line `i` (1 = the first reply) should do, so a talk is a conversation,
 * not an interview: mostly questions, every third line the partner shares
 * something and waits, and once in a longer talk you are asked to ask.
 */
export function replyKindFor(i: number, total: number): ReplyKind {
  if (i >= total) return 'question'; // the closing line has its own rule
  if (total >= 5 && i === Math.ceil(total / 2)) return 'invite';
  return i % 3 === 2 ? 'share' : 'question';
}
