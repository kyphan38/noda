// noda - Talk: a goal for each talk and three plain ratings at the end. No 0-100
// score on purpose: it would come from AI judgment that moves from run to run,
// so it would look exact without being exact. Pure.

import { countFillers } from './session';
import type { TalkLevel, TalkSession } from './types';

/** Set phrases to use in one talk. */
export function phraseGoal(level: TalkLevel, setSize: number): number {
  const goal = level === 'B1' ? 2 : level === 'B2' ? 3 : 4;
  return Math.min(goal, setSize);
}

/** Words per answer that sound like a full answer at each level. */
const WORDS_TARGET: Record<TalkLevel, number> = { B1: 8, B2: 12, C1: 16 };

export type Grade = 1 | 2 | 3;
export const GRADE_LABEL: Record<Grade, string> = { 3: 'Strong', 2: 'Good', 1: 'Keep practicing' };

export type Rating = { name: 'Accuracy' | 'Fluency' | 'Phrases'; grade: Grade; detail: string };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function rateTalk(s: TalkSession, setSize: number): Rating[] {
  const n = Math.max(1, s.turns.length);
  // Only real mistakes count against accuracy; "natural" and "tone" are style.
  const mistakes = s.turns.reduce(
    (a, t) => a + t.review.fixes.filter((f, i) => !(t.dismissedFixes ?? []).includes(i) && (f.kind === 'grammar' || f.kind === 'word' || f.kind === 'vietlish')).length,
    0,
  );
  const perAnswer = round1(mistakes / n);
  const words = s.turns.reduce((a, t) => a + t.transcript.split(/\s+/).filter(Boolean).length, 0) / n;
  const fillers = round1(s.turns.reduce((a, t) => a + countFillers(t.transcript), 0) / n);
  const target = WORDS_TARGET[s.level];
  const used = new Set(s.turns.flatMap((t) => t.usedPhraseIds)).size;
  const goal = phraseGoal(s.level, setSize);

  const accuracy: Grade = perAnswer <= 0.5 ? 3 : perAnswer <= 1.2 ? 2 : 1;
  const fluency: Grade = words >= target && fillers <= 1 ? 3 : words >= target * 0.6 && fillers <= 2.5 ? 2 : 1;
  const phrases: Grade = used >= goal ? 3 : used * 2 >= goal ? 2 : 1;
  return [
    { name: 'Accuracy', grade: accuracy, detail: `${perAnswer} ${perAnswer === 1 ? 'mistake' : 'mistakes'} per answer` },
    { name: 'Fluency', grade: fluency, detail: `${Math.round(words)} words per answer, ${fillers} uh/um` },
    { name: 'Phrases', grade: phrases, detail: `${used} of ${goal} set phrases` },
  ];
}
