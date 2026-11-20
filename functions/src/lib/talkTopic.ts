/**
 * Talk topic: the pure parts of `talkTopic` (request check, prompt, parsing).
 * No firebase-admin or @google/genai import, so the app's vitest suite can load it.
 * Keep TalkTopic in sync with src/lib/talk/types.ts.
 */

export const TALK_LEVELS = ["B1", "B2", "C1"] as const;
export type TalkLevel = (typeof TALK_LEVELS)[number];

export const SET_SIZE = 10;
export const SET_COUNT = 4;
export const PHRASE_COUNT = SET_SIZE * SET_COUNT;
/** Fewer than this after clean-up means the answer is not usable. */
export const MIN_PHRASES = SET_SIZE * 2;
/** 3: scenario cards (facts + opening + idea hints) instead of one opening line. */
export const TOPIC_VERSION = 3;
export const SCENARIO_COUNT = 5;
/** Who the lessons are for; also used by the talkTurn prompt. Topics can be about work or any part of life. */
export const LEARNER_ROLE = "an adult English learner who works as a DevOps engineer";

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 400;

export interface TopicRequest {
  topicId: string;
  kind: "preset" | "custom";
  presetId?: string;
  title: string;
  description: string;
  level: TalkLevel;
}

export interface TalkPhrase {
  id: string;
  text: string;
  ipa: string;
  meaning: string;
  example: string;
  setIndex: number;
}

/** A concrete situation inside the topic: facts to talk from, so the learner never has to invent a story. */
export interface TalkScenario {
  id: string;
  title: string;
  facts: string[];
  opening: string;
  /** Short notes of what the learner could say first. Ideas, never a ready answer. */
  ideas: string[];
}

export interface TopicContent {
  persona: { name: string; role: string; style: string };
  scenarios: TalkScenario[];
  phrases: TalkPhrase[];
}

const oneLine = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export function checkTopicRequest(data: unknown): TopicRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const topicId = oneLine(d.topicId, 80);
  if (!/^[a-z0-9-]{3,80}$/.test(topicId)) throw new Error("Bad topic id.");
  const kind = d.kind === "preset" ? "preset" : d.kind === "custom" ? "custom" : null;
  if (!kind) throw new Error("Bad kind.");
  const level = TALK_LEVELS.find((l) => l === d.level);
  if (!level) throw new Error("Bad level.");
  const title = oneLine(d.title, MAX_TITLE + 1);
  const description = oneLine(d.description, MAX_DESCRIPTION + 1);
  if (!title || title.length > MAX_TITLE) throw new Error("Bad title.");
  if (description.length > MAX_DESCRIPTION) throw new Error("Description is too long.");
  const presetId = kind === "preset" ? oneLine(d.presetId, 40) : undefined;
  if (kind === "preset" && !/^[a-z0-9-]{2,40}$/.test(presetId ?? "")) throw new Error("Bad preset id.");
  return { topicId, kind, presetId, title, description, level };
}

const LEVEL_NOTES: Record<TalkLevel, string> = {
  B1: "B1: common, simple phrases. Short examples with simple grammar.",
  B2: "B2: natural workplace phrases a fluent colleague uses every day. Not rare or formal.",
  C1: "C1: more precise and idiomatic phrases, still common in real tech teams.",
};

export function buildTopicPrompt(req: TopicRequest): string {
  return [
    `You make speaking lessons for ${LEARNER_ROLE}. Topics can be about work or everyday life (family, friends, shopping, travel, health). Write everything in English only.`,
    `Topic: ${req.title}`,
    req.description ? `Details: ${req.description}` : "",
    `Level: ${LEVEL_NOTES[req.level]}`,
    "",
    `Return ${PHRASE_COUNT} useful phrases for speaking about this topic, ordered from most to least useful.`,
    "Rules for phrases:",
    "- Collocations and chunks (verb + noun, set phrases, sentence starters, linking phrases), 2 to 6 words. Avoid single rare words.",
    "- Common in real spoken English in this kind of situation (at work only if the topic is about work). Nothing a native speaker would find odd or old-fashioned.",
    "- No two phrases with the same meaning.",
    "- text: the phrase in its base form, lowercase unless it starts a sentence or has a name.",
    "- ipa: American English IPA of the whole phrase, between slashes.",
    "- meaning: what the phrase means, in simple English (B1 words), at most 12 words. Do not use the phrase's own key words.",
    "- example: one spoken sentence about this topic, at most 15 words, that contains the phrase text EXACTLY as written (same words, same form).",
    "",
    "Also return:",
    "- persona: the other person in the conversation (a colleague, friend, family member, shop assistant... whatever fits the topic). name (a first name), role (who they are to the learner), style (one short line on how they talk).",
    `- scenarios: ${SCENARIO_COUNT} different, concrete and realistic situations inside this topic that the learner could really meet. Each has:`,
    "  title (at most 8 words);",
    "  facts: 3 or 4 short facts the learner can talk about (what happened, numbers, names of systems, times), each at most 12 words, written as notes, not full sentences;",
    "  opening: the first thing the persona says to start the talk, one or two sentences, a question the learner must answer;",
    "  ideas: 2 or 3 notes of what the learner could mention in the first answer, each at most 6 words. Notes only, never a sentence the learner could read out.",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
}

/** Model JSON -> topic content, or throws when it is not usable. */
export function parseTopicContent(raw: string | undefined): TopicContent {
  const d = JSON.parse(raw ?? "") as Record<string, unknown>;
  const persona = (d.persona ?? {}) as Record<string, unknown>;
  const list = Array.isArray(d.phrases) ? d.phrases : [];

  const seen = new Set<string>();
  const phrases: TalkPhrase[] = [];
  for (const item of list) {
    const p = (item ?? {}) as Record<string, unknown>;
    const text = oneLine(p.text, 60);
    const key = text.toLowerCase();
    const meaning = oneLine(p.meaning, 120);
    if (!text || !meaning || seen.has(key)) continue;
    seen.add(key);
    const i = phrases.length;
    phrases.push({
      id: `p${i}`,
      text,
      ipa: oneLine(p.ipa, 120),
      meaning,
      example: oneLine(p.example, 160),
      setIndex: Math.floor(i / SET_SIZE),
    });
    if (phrases.length === PHRASE_COUNT) break;
  }
  if (phrases.length < MIN_PHRASES) throw new Error(`Only ${phrases.length} usable phrases.`);

  const notes = (v: unknown, n: number, max: number) =>
    (Array.isArray(v) ? v : []).map((x) => oneLine(x, max)).filter(Boolean).slice(0, n);
  const scenarios: TalkScenario[] = [];
  for (const item of Array.isArray(d.scenarios) ? d.scenarios : []) {
    const s = (item ?? {}) as Record<string, unknown>;
    const opening = oneLine(s.opening, 300);
    const facts = notes(s.facts, 4, 100);
    if (!opening || facts.length === 0) continue;
    scenarios.push({ id: `s${scenarios.length}`, title: oneLine(s.title, 80) || `Situation ${scenarios.length + 1}`, facts, opening, ideas: notes(s.ideas, 3, 60) });
    if (scenarios.length === SCENARIO_COUNT) break;
  }

  const content: TopicContent = {
    persona: { name: oneLine(persona.name, 40), role: oneLine(persona.role, 60), style: oneLine(persona.style, 160) },
    scenarios,
    phrases,
  };
  if (!content.persona.name || scenarios.length === 0) throw new Error("Missing persona or scenarios.");
  return content;
}
