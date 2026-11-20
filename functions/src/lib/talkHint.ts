/**
 * Talk hint, level 2: the learner types the idea in simple words; one small
 * text call returns 2-3 chunks to build the answer with, never a full answer.
 * Pure parts only, so the app's vitest suite can load it.
 */
import { LEARNER_ROLE } from "./talkTopic";

export const MAX_HINTS = 3;
const MAX_IDEA = 200;

export interface HintRequest {
  topicId: string;
  aiLine: string;
  idea: string;
}
export interface TalkHint {
  text: string;
  use: string;
}

const line = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export function checkHintRequest(data: unknown): HintRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const topicId = line(d.topicId, 80);
  if (!/^[a-z0-9-]{3,80}$/.test(topicId)) throw new Error("Bad topic id.");
  const aiLine = line(d.aiLine, 600);
  const idea = line(d.idea, MAX_IDEA + 1);
  if (!aiLine) throw new Error("Missing the line you answer.");
  if (!idea || idea.length > MAX_IDEA) throw new Error("Write your idea in a few words.");
  return { topicId, aiLine, idea };
}

export function buildHintPrompt(req: HintRequest, topicTitle: string): string {
  return [
    `You help ${LEARNER_ROLE} who is stuck in a spoken English practice. English only.`,
    `Topic: ${topicTitle}`,
    `The other person said: "${req.aiLine}"`,
    `What the learner wants to say, in their own simple words: "${req.idea}"`,
    "",
    `Return hints: at most ${MAX_HINTS} useful chunks (2 to 6 words each: collocations, sentence starters, linking phrases)`,
    "the learner can build the answer with. Never a full sentence and never the full answer: the learner must still make the sentence.",
    "For each: text (the chunk) and use (at most 10 simple words on when or how to use it).",
  ].join("\n");
}

/** Model JSON -> hints; chunks longer than 8 words are dropped (too close to a full answer). */
export function parseHints(raw: string | undefined): TalkHint[] {
  const d = JSON.parse(raw ?? "") as { hints?: unknown };
  return (Array.isArray(d.hints) ? d.hints : [])
    .map((h) => ({ text: line((h as Record<string, unknown>)?.text, 80), use: line((h as Record<string, unknown>)?.use, 100) }))
    .filter((h) => h.text && h.text.split(" ").length <= 8)
    .slice(0, MAX_HINTS);
}
