/**
 * Speaking check: turns Gemini's labels into a score with fixed arithmetic.
 *
 * Gemini is never asked for a number out of 100. A free number moves between runs
 * on the same recording (78, then 84). It labels concrete things instead (which
 * words were wrong, did each sound habit happen, a 1-5 level per criterion with a
 * written rubric), and this file computes the score. The same labels always give
 * the same score. Pace is measured from the audio, not judged.
 *
 * No imports, so the app's vitest suite can load it.
 */

export type WordIssueKind = "mispronounced" | "missing";
export type CheckResult = "yes" | "partly" | "no";
export type SpeakingBand = "great" | "good" | "practice";

export interface WordIssue {
  /** 0-based index into the segment's word list. */
  index: number;
  kind: WordIssueKind;
  /** What the learner said instead, in plain English spelling. Empty when missing. */
  heard: string;
  /** One short instruction. */
  tip: string;
}

export interface SpeakingCheck {
  /** Index into the checklist sent to Gemini. */
  id: number;
  result: CheckResult;
}

export interface SpeakingCriteria {
  clarity: number;
  stress: number;
  intonation: number;
}

export interface DeliveryNote {
  aspect: "stress" | "intonation";
  text: string;
  why: string;
}

export interface SpeakingFix {
  text: string;
  why: string;
}

export interface SpeakingParts {
  /** 0-1 share for each part; `sounds` is null when the segment had no checklist. */
  words: number;
  sounds: number | null;
  delivery: number;
  pace: number;
}

export const MAX_FIXES = 3;
export const MAX_DELIVERY_NOTES = 2;

/** A mispronounced word still carries the meaning, a missing one does not. */
const ISSUE_WEIGHT: Record<WordIssueKind, number> = { mispronounced: 0.6, missing: 1 };
const CHECK_VALUE: Record<CheckResult, number> = { yes: 1, partly: 0.5, no: 0 };
const WEIGHTS = { words: 0.45, sounds: 0.25, delivery: 0.2, pace: 0.1 };

/** Splits a reference text into the words Gemini indexes. Keep punctuation attached. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Pace from the speech length of both clips: a learner at 0.85-1.3x the speaker's
 * length gets full marks (shadowing a bit slower is fine), falling to 0 at 0.5x / 2x.
 */
export function paceScore(learnerSeconds: number, referenceSeconds: number): number {
  if (!(learnerSeconds > 0) || !(referenceSeconds > 0)) return 0;
  const r = learnerSeconds / referenceSeconds;
  if (r >= 0.85 && r <= 1.3) return 1;
  if (r < 0.85) return clamp01((r - 0.5) / (0.85 - 0.5));
  return clamp01((2 - r) / (2 - 1.3));
}

export function scoreParts(input: {
  wordCount: number;
  issues: WordIssue[];
  checks: SpeakingCheck[];
  criteria: SpeakingCriteria;
  learnerSeconds: number;
  referenceSeconds: number;
}): SpeakingParts {
  const lost = input.issues.reduce((sum, i) => sum + ISSUE_WEIGHT[i.kind], 0);
  const words = input.wordCount > 0 ? clamp01(1 - lost / input.wordCount) : 0;
  const sounds =
    input.checks.length > 0
      ? input.checks.reduce((sum, c) => sum + CHECK_VALUE[c.result], 0) / input.checks.length
      : null;
  const { clarity, stress, intonation } = input.criteria;
  const delivery = clamp01(((clarity + stress + intonation) / 3 - 1) / 4);
  return { words, sounds, delivery, pace: paceScore(input.learnerSeconds, input.referenceSeconds) };
}

/** 0-100. Without a checklist, its weight is shared out over the other parts. */
export function overallScore(parts: SpeakingParts): number {
  let total = WEIGHTS.words * parts.words + WEIGHTS.delivery * parts.delivery + WEIGHTS.pace * parts.pace;
  let weight = WEIGHTS.words + WEIGHTS.delivery + WEIGHTS.pace;
  if (parts.sounds !== null) {
    total += WEIGHTS.sounds * parts.sounds;
    weight += WEIGHTS.sounds;
  }
  return Math.round((total / weight) * 100);
}

export function bandFor(score: number): SpeakingBand {
  if (score >= 85) return "great";
  if (score >= 65) return "good";
  return "practice";
}

/** Raised by `normalizeSpeakingAssessment` when Gemini's reply cannot be used. */
export class SpeakingShapeError extends Error {}

export interface NormalizedSpeaking {
  issues: WordIssue[];
  checks: SpeakingCheck[];
  criteria: SpeakingCriteria;
  delivery: DeliveryNote[];
  fixes: SpeakingFix[];
}

/**
 * Validates Gemini's reply against the request: word indexes must exist (one issue
 * per word), check ids must be in the checklist (each once, a missing one counts
 * as "no"), criteria are whole numbers 1-5. A fix about words already listed as
 * word issues is dropped: the learner sees those in the word list. Anything else
 * is dropped or clamped.
 */
export function normalizeSpeakingAssessment(
  raw: unknown,
  words: string[],
  checkCount: number
): NormalizedSpeaking {
  const wordCount = words.length;
  if (!raw || typeof raw !== "object") throw new SpeakingShapeError("Reply is not an object.");
  const r = raw as Record<string, unknown>;

  const crit = r.criteria as Record<string, unknown> | undefined;
  if (!crit || typeof crit !== "object") throw new SpeakingShapeError("Missing criteria.");
  const level = (v: unknown) => {
    const n = typeof v === "number" ? Math.round(v) : NaN;
    if (!Number.isFinite(n)) throw new SpeakingShapeError("Criteria level is not a number.");
    return Math.min(5, Math.max(1, n));
  };
  const criteria = { clarity: level(crit.clarity), stress: level(crit.stress), intonation: level(crit.intonation) };

  const issues: WordIssue[] = [];
  const seenWords = new Set<number>();
  for (const item of Array.isArray(r.wordIssues) ? r.wordIssues : []) {
    if (!item || typeof item !== "object") continue;
    const i = item as Record<string, unknown>;
    const index = typeof i.index === "number" ? Math.round(i.index) : -1;
    if (index < 0 || index >= wordCount || seenWords.has(index)) continue;
    if (i.kind !== "mispronounced" && i.kind !== "missing") continue;
    seenWords.add(index);
    issues.push({
      index,
      kind: i.kind,
      heard: i.kind === "missing" ? "" : str(i.heard),
      tip: str(i.tip),
    });
  }
  issues.sort((a, b) => a.index - b.index);

  const byId = new Map<number, CheckResult>();
  for (const item of Array.isArray(r.checks) ? r.checks : []) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const id = typeof c.id === "number" ? Math.round(c.id) : -1;
    if (id < 0 || id >= checkCount || byId.has(id)) continue;
    if (c.result !== "yes" && c.result !== "partly" && c.result !== "no") continue;
    byId.set(id, c.result);
  }
  const checks: SpeakingCheck[] = [];
  for (let id = 0; id < checkCount; id++) checks.push({ id, result: byId.get(id) ?? "no" });

  const delivery: DeliveryNote[] = [];
  const seenAspects = new Set<string>();
  for (const item of Array.isArray(r.delivery) ? r.delivery : []) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    if (d.aspect !== "stress" && d.aspect !== "intonation") continue;
    // A perfect level needs no note, and one note per aspect keeps it short.
    if (criteria[d.aspect] >= 5 || seenAspects.has(d.aspect)) continue;
    const why = str(d.why);
    if (!why) continue;
    seenAspects.add(d.aspect);
    delivery.push({ aspect: d.aspect, text: str(d.text), why });
    if (delivery.length >= MAX_DELIVERY_NOTES) break;
  }

  const issueWords = new Set(issues.map((i) => wordKey(words[i.index])));
  const fixes: SpeakingFix[] = [];
  for (const item of Array.isArray(r.fixes) ? r.fixes : []) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const why = str(f.why);
    if (!why) continue;
    const text = str(f.text);
    // "this song" when "this" is a word issue: the fix is about that word, already shown.
    const fixWords = text.split(/\s+/).map(wordKey).filter(Boolean);
    if (fixWords.some((w) => issueWords.has(w))) continue;
    fixes.push({ text, why });
    if (fixes.length >= MAX_FIXES) break;
  }

  return { issues, checks, criteria, delivery, fixes };
}

/** Built from its code point so the character itself never appears in the source. */
const EM_DASH = String.fromCharCode(0x2014);

function str(v: unknown): string {
  // No em dash anywhere in noda's text; the prompt asks too, this is the backstop.
  return typeof v === "string" ? v.split(EM_DASH).join(", ").trim() : "";
}

/** Lowercase letters, digits and apostrophes only, so "Song," matches "song". */
function wordKey(w: string | undefined): string {
  return (w ?? "").toLowerCase().replace(/[^a-z0-9']/g, "");
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
