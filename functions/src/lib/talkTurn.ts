/**
 * Talk turn: the pure parts of `talkTurn` (request check, prompt, parsing).
 * One model call per turn: the learner's audio in; the exact transcript, the
 * persona's next line and a short review out. Keep shapes in sync with
 * src/lib/talk/types.ts (TalkTurnResult).
 */
import { LEARNER_ROLE } from "./talkTopic";

export const FIX_KINDS = ["grammar", "word", "natural", "tone", "vietlish"] as const;
export type FixKind = (typeof FIX_KINDS)[number];

/** Fixed list, so the mistake bank can group fixes across sessions. */
export const FIX_PATTERNS = [
  "plural_s",
  "verb_tense",
  "verb_form",
  "subject_verb",
  "article",
  "preposition",
  "word_order",
  "missing_word",
  "word_choice",
  "collocation",
  "vietlish",
  "tone",
  "other",
] as const;

export const MAX_FIXES = 3;
export const MAX_HISTORY = 3;
export const MAX_TARGETS = 12;
const MAX_LINE = 600;

export type Level = "B1" | "B2" | "C1";

/** What the next line does: ask, share something of its own, or invite the learner to ask. */
export const REPLY_KINDS = ["question", "share", "invite"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];

export interface TurnRequest {
  topicId: string;
  scenarioId: string;
  aiLine: string;
  history: { ai: string; you: string }[];
  targetIds: string[];
  curveball: boolean;
  isLast: boolean;
  replyKind: ReplyKind;
  /** The learner's local time, for example "Friday afternoon". */
  when: string;
}

/** Answer frames for topics where structure matters. */
export type Frame = "bluf" | "star";
const FRAME_BY_PRESET: Record<string, Frame> = {
  incident: "bluf",
  "on-call": "bluf",
  postmortem: "bluf",
  pipeline: "bluf",
  standup: "bluf",
  change: "bluf",
  "one-on-one": "bluf",
  "explain-pm": "bluf",
  interview: "star",
};
export const frameFor = (presetId?: string): Frame | undefined => (presetId ? FRAME_BY_PRESET[presetId] : undefined);

const FRAME_RULES: Record<Frame, string> = {
  bluf: "BLUF: the main point or answer first, then the reasons and details.",
  star: "STAR: Situation, Task, Action, Result, in that order, with a clear result.",
};
/** Answers shorter than this are not judged on structure. */
export const FRAME_MIN_WORDS = 35;

export interface TurnContext {
  level: Level;
  frame?: Frame;
  topicTitle: string;
  persona: { name: string; role: string; style: string };
  targets: { id: string; text: string }[];
  /** Facts of the session's situation, so the talk stays on one consistent story. */
  facts: string[];
  /** How the persona feels in this situation. */
  mood?: string;
  /** Facts about the learner from earlier talks with this character. */
  memory?: string[];
}

export interface TalkFix {
  kind: FixKind;
  wrong: string;
  right: string;
  why: string;
  pattern: string;
}

export interface TurnResult {
  transcript: string;
  reply: { text: string; curveball: boolean; ideas: string[] };
  review: { correct: string; natural: string; levelUp: string; fixes: TalkFix[]; structure?: string };
  usedPhraseIds: string[];
}

const line = (v: unknown, max = MAX_LINE) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Everything but the recording, which the handler checks itself. */
export function checkTurnRequest(data: unknown): TurnRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const topicId = line(d.topicId, 80);
  if (!/^[a-z0-9-]{3,80}$/.test(topicId)) throw new Error("Bad topic id.");
  const aiLine = line(d.aiLine);
  if (!aiLine) throw new Error("Missing the line you answered.");
  const scenarioId = line(d.scenarioId, 8);
  if (!/^s\d{1,2}$/.test(scenarioId)) throw new Error("Bad scenario id.");
  const history = (Array.isArray(d.history) ? d.history : [])
    .slice(-MAX_HISTORY)
    .map((h) => ({ ai: line((h as Record<string, unknown>)?.ai), you: line((h as Record<string, unknown>)?.you) }))
    .filter((h) => h.ai || h.you);
  const targetIds = (Array.isArray(d.targetIds) ? d.targetIds : [])
    .filter((id): id is string => typeof id === "string" && /^p\d{1,3}$/.test(id))
    .slice(0, MAX_TARGETS);
  const replyKind = REPLY_KINDS.find((k) => k === d.replyKind) ?? "question";
  const when = /^[A-Za-z ]{3,40}$/.test(line(d.when, 40)) ? line(d.when, 40) : "";
  return { topicId, scenarioId, aiLine, history, targetIds, curveball: d.curveball === true, isLast: d.isLast === true, replyKind, when };
}

const LEVEL_NOTES: Record<Level, string> = {
  B1: "B1: keep 'natural' simple and short; 'levelUp' is B2.",
  B2: "B2: 'natural' sounds like a fluent colleague; 'levelUp' is C1.",
  C1: "C1: 'natural' is precise and idiomatic; 'levelUp' is how a sharp native speaker would put it.",
};

const REPLY_RULES: Record<ReplyKind, string> = {
  question:
    "- React briefly to what the learner said, then ask ONE natural follow-up question. One or two sentences. Where it fits, steer toward a situation where one of the target phrases would be useful, but never name or hint the phrases.",
  share:
    "- React to what the learner said, then share a short opinion or experience of your own about it, and end WITHOUT a question, so the learner reacts or adds their view. At most two sentences.",
  invite:
    "- React briefly, then hand the turn to the learner: end with ONE short, direct question that asks them to ask YOU something now, about you or this topic (for example \"Anything you want to ask me about the release?\" in your own words). Not a polite offer like \"let me know if you need anything\". Do not ask a content question yourself.",
};

export function buildTurnPrompt(req: TurnRequest, ctx: TurnContext): string {
  const p = ctx.persona;
  const targets = ctx.targets.map((t) => `- ${t.id}: ${t.text}`).join("\n");
  const history = req.history.map((h) => `${p.name}: ${h.ai}\nLearner: ${h.you}`).join("\n");
  const replyRule = req.isLast
    ? "- This is the last turn: react to the answer and close the talk politely in one or two sentences. No new question."
    : req.curveball
      ? "- Curveball: do NOT simply ask the next question. Either misunderstand one point on purpose so the learner must clarify, or push back on it, or ask a pointed follow-up about a risk, a deadline or a number. Stay polite and realistic. One or two sentences."
      : REPLY_RULES[req.replyKind];
  const answerFirst =
    "- This is a real conversation, not an interview. If the learner asked you something, first answer it briefly and honestly as " + p.name + ".";

  return [
    `You run a spoken English practice for ${LEARNER_ROLE}. Everything you write is in English only.`,
    `Topic: ${ctx.topicTitle}`,
    `You play ${p.name}, ${p.role}. Style: ${p.style}`,
    `Level: ${LEVEL_NOTES[ctx.level]}`,
    ctx.mood ? `Your mood in this situation: ${ctx.mood}. Let it show in how you talk.` : "",
    req.when ? `For the learner it is ${req.when} now.` : "",
    ctx.memory?.length
      ? `What you remember about the learner from earlier talks:\n${ctx.memory.map((m) => `- ${m}`).join("\n")}\nIf it fits, bring one up once early in the talk, like a real person would (ask how it went). Do not repeat it later.`
      : "",
    ctx.facts.length ? `Situation (facts the learner can use; keep the talk consistent with them):\n${ctx.facts.map((f) => `- ${f}`).join("\n")}` : "",
    "",
    history ? `Talk so far:\n${history}` : "",
    `${p.name} just said: "${req.aiLine}"`,
    "The audio is the learner's spoken answer.",
    "",
    "1. transcript: write EXACTLY what the learner said, word for word. Keep every grammar mistake, wrong word,",
    "   missing word, repetition and filler (uh, um). Do NOT correct, improve or complete anything.",
    "   If a word is not clear, write [unclear]. If there is no speech, return an empty transcript.",
    "2. review (keep the learner's meaning; do not add new ideas):",
    "   - correct: the transcript with only the mistakes fixed, keeping the learner's own words where possible.",
    "   - natural: how a fluent colleague would say the same thing.",
    "   - levelUp: one level above the learner.",
    `   - fixes: at most ${MAX_FIXES}, the most useful first. Fewer is fine; none if the answer is already good.`,
    "     wrong: the exact words copied from the transcript. right: the fixed words, written exactly as they appear in 'correct'",
    "     (for kind natural or tone, exactly as in 'natural'). Every fix must agree with those versions.",
    "     Only real mistakes are grammar or word fixes. Correct English is not a mistake just because another tense",
    "     or word also works; if a change only sounds better, use kind natural, or leave it out.",
    "     why: the reason in simple English (B1 words), at most 15 words.",
    "     kind: grammar, word (wrong word), natural (correct but unnatural), tone (sounds rude or too direct),",
    "     vietlish (translated word for word from Vietnamese, for example 'according to me', 'explain me').",
    `     pattern: one of ${FIX_PATTERNS.join(", ")}.`,
    "3. reply: what you say next, as " + p.name + ".",
    answerFirst,
    replyRule,
    "- Sound like a real person talking, not writing: contractions, short sentences, small spoken reactions (Oh, Hmm, Right, Oh no) and real feelings (surprise, worry, relief, a light joke) when they fit. No lists, no formal phrases.",
    "- If the learner made a clear mistake in an important word or verb, echo their idea back correctly inside your reply, the way people do in conversation (they say \"I go to the office yesterday\", you say \"Oh, you went in yesterday?\"). Never say they made a mistake.",
    "- Listen to how they spoke: if the answer was very short (a few words), kindly ask for a bit more. If they hesitated a lot (long pauses, or 3 or more uh/um in your transcript), your reply MUST start with a short encouraging phrase (No rush, Take your time, No worries) before anything else.",
    "   Set curveball to true only when this reply is a curveball.",
    req.isLast
      ? "   ideas: an empty list."
      : "   ideas: 2 or 3 notes of what the learner could say or ask next, each at most 6 words, from the situation or common sense. Notes only, never a sentence the learner could read out.",
    "4. usedPhraseIds: ids of the target phrases the learner used with the right meaning (other verb forms are fine).",
    ctx.frame
      ? `5. structure: this topic uses ${FRAME_RULES[ctx.frame]} Only if the answer has at least ${FRAME_MIN_WORDS} words and does not follow it, say in one sentence (at most 20 simple words) how to reorder it. Otherwise an empty string.`
      : "5. structure: an empty string.",
    targets ? `Target phrases:\n${targets}` : "Target phrases: none.",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
}

export class TurnShapeError extends Error {}

/** Model JSON -> a clean result, or throws TurnShapeError when it is not usable. */
export function parseTurnResult(raw: string | undefined, targetIds: string[]): TurnResult {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw ?? "") as Record<string, unknown>;
  } catch {
    throw new TurnShapeError("Not JSON.");
  }
  const transcript = line(d.transcript, 2000);
  const reply = (d.reply ?? {}) as Record<string, unknown>;
  const review = (d.review ?? {}) as Record<string, unknown>;
  const replyText = line(reply.text);
  if (!replyText) throw new TurnShapeError("No reply.");

  const fixes: TalkFix[] = [];
  for (const f of Array.isArray(review.fixes) ? review.fixes : []) {
    const x = (f ?? {}) as Record<string, unknown>;
    const kind = FIX_KINDS.find((k) => k === x.kind);
    const wrong = line(x.wrong, 200);
    const right = line(x.right, 200);
    if (!kind || !wrong || !right || wrong.toLowerCase() === right.toLowerCase()) continue;
    const pattern = FIX_PATTERNS.find((p) => p === x.pattern) ?? "other";
    fixes.push({ kind, wrong, right, why: line(x.why, 160), pattern });
    if (fixes.length === MAX_FIXES) break;
  }

  const correct = line(review.correct, 2000) || transcript;
  const natural = line(review.natural, 2000) || correct;
  const allowed = new Set(targetIds);
  const used = (Array.isArray(d.usedPhraseIds) ? d.usedPhraseIds : []).filter(
    (id, i, all): id is string => typeof id === "string" && allowed.has(id) && all.indexOf(id) === i
  );
  return {
    transcript,
    reply: {
      text: replyText,
      curveball: reply.curveball === true,
      ideas: (Array.isArray(reply.ideas) ? reply.ideas : []).map((x) => line(x, 60)).filter(Boolean).slice(0, 3),
    },
    review: { correct, natural, levelUp: line(review.levelUp, 2000) || natural, fixes, ...(line(review.structure, 200) ? { structure: line(review.structure, 200) } : {}) },
    usedPhraseIds: used,
  };
}
