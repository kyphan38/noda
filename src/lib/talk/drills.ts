// noda - Talk drills: 4/3/2 (say it faster each round), Read-to-Speak and the
// monthly Time Capsule. Pure.

import { countFillers, wordsPerMinute } from './session';

/** Seconds per round: the same answer, shorter each time. */
export const ROUND_SECONDS = [60, 45, 30] as const;
export const RETELL_SECONDS = 90;
export const CAPSULE_SECONDS = 90;
export const CAPSULE_PROMPT = 'Introduce yourself and say what you are working on these days. About one minute.';

export const DRILL_QUESTIONS = [
  'Tell me about the hardest problem you solved at work this month.',
  'How do you usually spend your weekends?',
  'Explain what your team does to someone outside tech.',
  'What would you change about your current job, and why?',
  'Describe a trip you remember well.',
  'Tell me about a mistake you made and what you learned.',
  'What is a tool or habit that saves you time every day?',
  'How do you deal with stress before a big deadline?',
];

export type RoundNumbers = { words: number; wpm: number; fillers: number };

export function roundNumbers(transcript: string, seconds: number): RoundNumbers {
  return {
    words: transcript.split(/\s+/).filter(Boolean).length,
    wpm: wordsPerMinute(transcript, seconds),
    fillers: countFillers(transcript),
  };
}

/** "2026-11" in local time: one capsule per month. */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type TalkCapsule = {
  month: string;
  storagePath: string;
  url: string;
  seconds: number;
  transcript: string;
  createdAt: number;
};

/** True when this month has no capsule yet. */
export function capsuleDue(capsules: Pick<TalkCapsule, 'month'>[], now: number): boolean {
  return !capsules.some((c) => c.month === monthKey(now));
}
