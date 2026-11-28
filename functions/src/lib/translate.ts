/**
 * Sentence translation: the pure parts of `translateSentences`. No firebase-admin or
 * @google/genai import, so the app's vitest suite (and its build) can load it.
 */

/** Most sentences translated in one model call. Keep in sync with TRANSLATE_BATCH in src/lib/translate.ts. */
export const MAX_BATCH = 20;
export const MAX_CONTEXT = 2;
export const MAX_SENTENCE_CHARS = 600;
export const MAX_TITLE_CHARS = 200;
/** Cached docs with another version are translated again. */
export const TRANSLATION_VERSION = 1;

export interface TranslateItem {
  id: number;
  text: string;
}

export interface TranslateRequest {
  lessonId: string;
  title: string;
  items: TranslateItem[];
  /** Sentences just before the first item, only to help the model. */
  context: string[];
}

export interface Translation {
  id: number;
  vi: string;
}

/** Same clean-up as the client (src/lib/translate.ts), so cached `en` texts match. */
export const cleanSentence = (s: string) => s.trim().replace(/\s+/g, " ");

const cleanText = (v: unknown, max: number) => (typeof v === "string" ? cleanSentence(v).slice(0, max) : "");

export function checkTranslateRequest(data: unknown): TranslateRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const lessonId = typeof d.lessonId === "string" ? d.lessonId.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(lessonId)) throw new Error("Bad lesson id.");
  const rawItems = Array.isArray(d.items) ? d.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_BATCH) throw new Error("Bad sentence list.");
  const seen = new Set<number>();
  const items = rawItems.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = r.id;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || seen.has(id)) throw new Error("Bad sentence id.");
    seen.add(id);
    const text = typeof r.text === "string" ? cleanSentence(r.text) : "";
    if (!text || text.length > MAX_SENTENCE_CHARS) throw new Error("Bad sentence.");
    return { id, text };
  });
  const context = (Array.isArray(d.context) ? d.context : [])
    .slice(-MAX_CONTEXT)
    .map((c) => cleanText(c, MAX_SENTENCE_CHARS))
    .filter(Boolean);
  return { lessonId, title: cleanText(d.title, MAX_TITLE_CHARS), items, context };
}

export function buildTranslatePrompt(title: string, items: readonly TranslateItem[], context: readonly string[]): string {
  const lines = [
    "You help a Vietnamese learner of English (about IELTS 6) who is listening to a lesson.",
    "Translate each numbered English sentence into natural, everyday Vietnamese.",
    "- Keep the meaning, not the word order. Do not translate word by word.",
    "- Keep names, numbers and technical terms clear. A common English term may stay in English.",
    "- One translation per sentence. Do not merge or split sentences. Do not add notes.",
    "- The sentences come from a transcript, so one may be part of a longer sentence. Translate only what is there.",
  ];
  if (title) lines.push("", `Lesson title: "${title}"`);
  if (context.length > 0) {
    lines.push("", "Earlier sentences (context only, do not translate):");
    for (const c of context) lines.push(`- ${c}`);
  }
  lines.push("", "Sentences to translate:");
  for (const it of items) lines.push(`[${it.id}] ${it.text}`);
  lines.push("", 'Return "items": one { "id", "vi" } for every sentence above, with the same id.');
  return lines.join("\n");
}

/** Model JSON -> translations for the asked ids, or throws when any is missing. */
export function parseTranslations(raw: string | undefined, ids: readonly number[]): Translation[] {
  const d = JSON.parse(raw ?? "") as { items?: unknown };
  const list = Array.isArray(d.items) ? d.items : [];
  const byId = new Map<number, string>();
  for (const item of list) {
    const r = (item ?? {}) as Record<string, unknown>;
    const vi = cleanText(r.vi, 1000);
    if (typeof r.id === "number" && vi && !byId.has(r.id)) byId.set(r.id, vi);
  }
  const out = ids.map((id) => ({ id, vi: byId.get(id) ?? "" }));
  if (out.some((t) => !t.vi)) throw new Error("Incomplete translation.");
  return out;
}

export interface CachedTranslation {
  en?: unknown;
  vi?: unknown;
  version?: unknown;
}

/** A cache doc is usable only for the same sentence text and the current version. */
export function usableCache(doc: CachedTranslation | undefined, text: string): string | null {
  if (!doc || doc.version !== TRANSLATION_VERSION) return null;
  if (typeof doc.en !== "string" || cleanSentence(doc.en) !== text) return null;
  return typeof doc.vi === "string" && doc.vi ? doc.vi : null;
}
