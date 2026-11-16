/**
 * Word card (N3): the pure parts of `defineWord`. No firebase-admin or @google/genai
 * import, so the app's vitest suite (and its build) can load it.
 */
import { createHash } from "crypto";

export const MAX_WORD_CHARS = 40;
export const MAX_SENTENCE_CHARS = 400;

export interface WordRequest {
  word: string;
  sentence: string;
}

export interface WordCard {
  word: string;
  ipa: string;
  partOfSpeech: string;
  meaning: string;
}

/** The word as looked up: lowercase, no punctuation around it. */
export function cleanWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function checkWordRequest(data: unknown): WordRequest {
  const d = (data ?? {}) as { word?: unknown; sentence?: unknown };
  const word = typeof d.word === "string" ? cleanWord(d.word) : "";
  const sentence = typeof d.sentence === "string" ? d.sentence.trim().replace(/\s+/g, " ") : "";
  if (!word || word.length > MAX_WORD_CHARS || !/\p{L}/u.test(word)) throw new Error("Bad word.");
  if (!sentence || sentence.length > MAX_SENTENCE_CHARS) throw new Error("Bad sentence.");
  return { word, sentence };
}

/** Cache id: the word plus its sentence, because the meaning depends on the sentence. */
export function wordKey(req: WordRequest): string {
  const hash = createHash("sha256").update(req.sentence.toLowerCase()).digest("hex").slice(0, 12);
  const safe = req.word.replace(/[^\p{L}\p{N}'-]/gu, "_").replace(/\//g, "_");
  return `${safe}__${hash}`;
}

export function buildWordPrompt(req: WordRequest): string {
  return [
    "You help an English learner (about IELTS 6) who is listening to a lesson.",
    `Word: "${req.word}"`,
    `Sentence: "${req.sentence}"`,
    "Return:",
    "- ipa: the American English IPA of the word, between slashes, for example /ˈwɔːtər/.",
    "- partOfSpeech: one word, for example noun, verb, adjective, adverb, phrase.",
    "- meaning: what the word means in THIS sentence, in simple English, at most 20 words. Do not use the word itself. No other language.",
  ].join("\n");
}

/** Model JSON -> a card, or throws when a field is missing. */
export function parseWordCard(raw: string | undefined, word: string): WordCard {
  const d = JSON.parse(raw ?? "") as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const card = { word, ipa: str(d.ipa, 60), partOfSpeech: str(d.partOfSpeech, 20).toLowerCase(), meaning: str(d.meaning, 200) };
  if (!card.ipa || !card.meaning) throw new Error("Incomplete word card.");
  return card;
}
