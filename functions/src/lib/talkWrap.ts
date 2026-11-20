/**
 * Talk wrap: the pure parts of `talkWrap` (request check, prompt, parsing).
 * One text-only model call when a talk ends; the result is saved on the
 * session, so notes are never asked for twice. Keep shapes in sync with
 * src/lib/talk/types.ts (TalkWrap).
 */
import { LEARNER_ROLE } from "./talkTopic";

export const MAX_MISSED = 3;
export const MAX_SWAPS = 4;
export const MAX_PICKS = 3;
/** Older phrases sent to check for Active use; keeps the prompt small. */
export const MAX_KNOWN = 40;

export interface WrapRequest {
  sessionId: string;
  /** Phrases from other sets or topics, not on this talk's checklist. */
  known: { key: string; text: string }[];
}

export interface WrapTurn {
  ai: string;
  you: string;
  natural: string;
}

export interface TalkWrap {
  missedChances: { turn: number; phraseId: string; said: string; better: string }[];
  swaps: { from: string; to: string; why: string }[];
  closingPicks: { turn: number; idea: string; target: string }[];
  activeKeys: string[];
  focus: string;
}

const line = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export function checkWrapRequest(data: unknown): WrapRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const sessionId = line(d.sessionId, 120);
  if (!/^[a-z0-9-]{3,120}$/.test(sessionId)) throw new Error("Bad session id.");
  const known = (Array.isArray(d.known) ? d.known : [])
    .map((k) => {
      const x = (k ?? {}) as Record<string, unknown>;
      return { key: line(x.key, 120), text: line(x.text, 60) };
    })
    .filter((k) => /^[a-z0-9-]+__p\d{1,3}$/.test(k.key) && k.text)
    .slice(0, MAX_KNOWN);
  return { sessionId, known };
}

export function buildWrapPrompt(
  turns: WrapTurn[],
  targets: { id: string; text: string }[],
  known: { key: string; text: string }[],
  usedIds: string[]
): string {
  const talk = turns.map((t, i) => `Turn ${i}\nThem: ${t.ai}\nLearner: ${t.you}\nNatural: ${t.natural}`).join("\n\n");
  const unused = targets.filter((t) => !usedIds.includes(t.id));
  return [
    `You coach ${LEARNER_ROLE} after a spoken English practice talk. Write everything in English only, in simple words (B1).`,
    "",
    talk,
    "",
    unused.length ? `Target phrases the learner did NOT use:\n${unused.map((t) => `- ${t.id}: ${t.text}`).join("\n")}` : "Target phrases the learner did not use: none.",
    known.length ? `Phrases learned before:\n${known.map((k) => `- ${k.key}: ${k.text}`).join("\n")}` : "Phrases learned before: none.",
    "",
    "Return:",
    `- missedChances: at most ${MAX_MISSED}. A turn where one of the unused target phrases would fit well.`,
    "  turn: the turn number. phraseId: the id. said: the learner's words it would replace, copied exactly.",
    "  better: the learner's sentence rewritten with the phrase. Only real, natural chances; fewer is fine.",
    `- swaps: at most ${MAX_SWAPS}. Plain or repeated words the learner used (from) and a better word or collocation (to),`,
    "  with why in at most 12 words. Only words that really appear in the learner's lines.",
    `- closingPicks: the ${MAX_PICKS} learner turns that needed the most work (fewer if the talk was short).`,
    "  idea: what the learner wanted to say, in at most 15 simple words, NOT using the words of the natural version.",
    "  target: the natural version of that turn, at most 25 words.",
    "- activeKeys: keys of 'phrases learned before' that the learner used with the right meaning (other forms are fine).",
    "- focus: one thing to work on next time, at most 15 words.",
  ].join("\n");
}

export class WrapShapeError extends Error {}

/** Model JSON -> clean notes, or throws WrapShapeError. Turn numbers and ids are checked against the talk. */
export function parseWrap(
  raw: string | undefined,
  turnCount: number,
  targetIds: string[],
  knownKeys: string[]
): TalkWrap {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw ?? "") as Record<string, unknown>;
  } catch {
    throw new WrapShapeError("Not JSON.");
  }
  const list = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => (x ?? {}) as Record<string, unknown>);
  const turnOk = (t: unknown): t is number => typeof t === "number" && Number.isInteger(t) && t >= 0 && t < turnCount;

  const missedChances = list(d.missedChances)
    .filter((m) => turnOk(m.turn) && targetIds.includes(m.phraseId as string))
    .map((m) => ({ turn: m.turn as number, phraseId: m.phraseId as string, said: line(m.said, 200), better: line(m.better, 300) }))
    .filter((m) => m.better)
    .slice(0, MAX_MISSED);
  const swaps = list(d.swaps)
    .map((s) => ({ from: line(s.from, 60), to: line(s.to, 60), why: line(s.why, 120) }))
    .filter((s) => s.from && s.to && s.from.toLowerCase() !== s.to.toLowerCase())
    .slice(0, MAX_SWAPS);
  const seen = new Set<number>();
  const closingPicks = list(d.closingPicks)
    .filter((p) => turnOk(p.turn) && !seen.has(p.turn as number) && seen.add(p.turn as number))
    .map((p) => ({ turn: p.turn as number, idea: line(p.idea, 160), target: line(p.target, 300) }))
    .filter((p) => p.idea && p.target)
    .slice(0, MAX_PICKS);
  const activeKeys = (Array.isArray(d.activeKeys) ? d.activeKeys : []).filter(
    (k, i, all): k is string => typeof k === "string" && knownKeys.includes(k) && all.indexOf(k) === i
  );
  if (turnCount > 0 && closingPicks.length === 0) throw new WrapShapeError("No closing picks.");
  return { missedChances, swaps, closingPicks, activeKeys, focus: line(d.focus, 160) };
}
