/**
 * Server-side guard between Gemini's JSON and what we cache forever.
 *
 * The cache doc is permanent, so anything malformed that slips through here is
 * wrong on screen for good. Two kinds of problem get two different treatments:
 *
 * - Structural / whole-sentence failures (no chunks, or the tokens no longer
 *   spell the transcript) throw `ShadowingShapeError`, which the caller retries
 *   once before giving up. A silently reworded transcript is the one failure the
 *   learner cannot detect by eye, so it must never be cached.
 * - Field-level slips (a `display` that drifted, a content word marked `weak`,
 *   a seventh note, a Vietnamese-style `sounds`) are repaired or dropped in place.
 *   These cost a detail, not the whole analysis, and a retry would likely
 *   reproduce them.
 */

/** Thrown when the response is structurally unusable - the caller retries once. */
export class ShadowingShapeError extends Error {}

/** Keep in sync with `SHADOWING_MAX_NOTES` / `SHADOWING_MAX_RHYTHM_NOTES` in constants/index.tsx. */
const MAX_NOTES = 6;
const MAX_RHYTHM_NOTES = 1;
const LEVELS = new Set(["strong", "normal", "weak"]);
const TONES = new Set(["rise", "fall", "fall-rise", "rise-fall", "flat"]);
const NOTE_TYPES = new Set(["linking", "reduction", "elision", "assimilation", "rhythm"]);

/**
 * Words allowed to carry `level: "weak"`. The prompt says only function words may
 * be reduced, and the spike never saw that violated - this list makes it true by
 * construction rather than by hope, so a stray `weak` on a content word can't dim
 * a word the learner actually needs to hear.
 */
const FUNCTION_WORDS = new Set([
  "a", "an", "the",
  "am", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "can", "could", "shall", "should", "will", "would", "may", "might", "must",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "mine", "yours", "ours", "theirs",
  "this", "that", "these", "those", "there", "here",
  "and", "or", "but", "so", "if", "as", "than", "then", "because", "while", "though",
  "at", "by", "for", "from", "in", "into", "of", "off", "on", "onto", "out", "over",
  "to", "up", "with", "without", "about", "after", "before", "between", "through",
  "under", "until", "upon", "not", "no", "nor", "too", "just", "some", "any",
  // Contractions keep their host word's class: "I'm", "that's", "didn't" are all
  // reducible. Matched on letters only, so the apostrophe is already gone by here.
  "im", "ive", "ill", "id", "youre", "youve", "youll", "youd", "hes", "shes", "its",
  "were", "weve", "well", "wed", "theyre", "theyve", "theyll", "theyd",
  "thats", "theres", "whats", "dont", "doesnt", "didnt", "isnt", "arent", "wasnt",
  "werent", "hasnt", "havent", "hadnt", "cant", "couldnt", "wont", "wouldnt",
  "shouldnt", "mustnt",
]);

const letters = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type RawToken = { w?: unknown; display?: unknown; level?: unknown; linked?: unknown };
type RawChunk = { tokens?: unknown; tone?: unknown; toneStrength?: unknown };
type RawNote = { type?: unknown; text?: unknown; via?: unknown; sounds?: unknown; ipa?: unknown; why?: unknown };

export interface NormalizedToken {
  w: string;
  display: string;
  level: "strong" | "normal" | "weak";
  linked?: boolean;
}
export interface NormalizedChunk {
  tokens: NormalizedToken[];
  tone: "rise" | "fall" | "fall-rise" | "rise-fall" | "flat";
  toneStrength: "strong" | "weak";
}
export interface NormalizedNote {
  type: "linking" | "reduction" | "elision" | "assimilation" | "rhythm";
  text: string;
  /** Intermediate spoken form of a multi-step change ("I'm gonna"); omitted when single-step. */
  via?: string;
  sounds: string;
  ipa: string;
  why: string;
}
export interface NormalizedAnalysis {
  chunks: NormalizedChunk[];
  notes: NormalizedNote[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Any letter outside A-Z, e.g. "đ" or a toned vowel like "ồ". */
const NON_ASCII_LETTER = /(?![A-Za-z])\p{L}/u;

/**
 * `sounds` must be an English-style respelling ("LIH-dl"). A Vietnamese-style one
 * ("li-đồ") teaches tones and letters the speaker never used, so it is dropped
 * rather than cached - the note still shows its IPA and coaching line.
 */
const respelling = (s: string): string => (NON_ASCII_LETTER.test(s) ? "" : s);

function normalizeToken(raw: RawToken): NormalizedToken | null {
  const w = typeof raw.w === "string" ? raw.w.trim() : "";
  if (!w) return null;

  let level: NormalizedToken["level"] = LEVELS.has(raw.level as string)
    ? (raw.level as NormalizedToken["level"])
    : "normal";

  // A content word must stay fully visible even if Gemini called it weak.
  if (level === "weak" && !FUNCTION_WORDS.has(letters(w))) level = "normal";

  // `display` may differ from `w` by letter CASE only. Compared on the whole string,
  // not on letters alone: a letters-only check let "halfway" come back as "HALF-way",
  // which renders a hyphen the transcript never had.
  const rawDisplay = typeof raw.display === "string" ? raw.display.trim() : "";
  const caseOnlyChange = !!rawDisplay && rawDisplay.toLowerCase() === w.toLowerCase();
  const display = caseOnlyChange && level === "strong" ? rawDisplay : w;

  const token: NormalizedToken = { w, display, level };
  if (raw.linked === true) token.linked = true;
  return token;
}

function normalizeNotes(raw: unknown): NormalizedNote[] {
  if (!Array.isArray(raw)) return [];
  const sounds: NormalizedNote[] = [];
  const rhythm: NormalizedNote[] = [];

  for (const item of raw) {
    if (sounds.length + rhythm.length >= MAX_NOTES) break;
    if (!item || typeof item !== "object") continue;
    const n = item as RawNote;
    if (!NOTE_TYPES.has(n.type as string)) continue;

    const why = str(n.why);
    if (!why) continue; // a note with no coaching instruction has nothing to show

    const type = n.type as NormalizedNote["type"];
    if (type === "rhythm") {
      if (rhythm.length >= MAX_RHYTHM_NOTES) continue;
      // Rhythm notes are about timing, not a specific sound - drop any example
      // the model attached anyway so the panel renders them as a plain line.
      rhythm.push({ type, text: "", sounds: "", ipa: "", why });
      continue;
    }
    const text = str(n.text);
    const note: NormalizedNote = { type, text, sounds: respelling(str(n.sounds)), ipa: str(n.ipa), why };
    // A "via" that only repeats the transcript words adds an arrow and no information.
    const via = respelling(str(n.via));
    if (via && letters(via) !== letters(text)) note.via = via;
    sounds.push(note);
  }

  // Sound notes stay in sentence order so the list reads alongside the line above;
  // the rhythm note is about the whole line, so it belongs after all of them
  // regardless of where the model happened to put it.
  return [...sounds, ...rhythm];
}

/** @throws ShadowingShapeError when the response cannot be repaired. */
export function normalizeShadowingAnalysis(raw: unknown, sourceText: string): NormalizedAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new ShadowingShapeError("Analysis is not an object.");
  }
  const rawChunks = (raw as { chunks?: unknown }).chunks;
  if (!Array.isArray(rawChunks) || rawChunks.length === 0) {
    throw new ShadowingShapeError("Analysis has no chunks.");
  }

  const chunks: NormalizedChunk[] = [];
  for (const item of rawChunks) {
    if (!item || typeof item !== "object") continue;
    const c = item as RawChunk;
    const tokens = (Array.isArray(c.tokens) ? c.tokens : [])
      .map((t) => normalizeToken((t ?? {}) as RawToken))
      .filter((t): t is NormalizedToken => t !== null);
    if (tokens.length === 0) continue;

    chunks.push({
      tokens,
      tone: TONES.has(c.tone as string) ? (c.tone as NormalizedChunk["tone"]) : "flat",
      toneStrength: c.toneStrength === "weak" ? "weak" : "strong",
    });
  }
  if (chunks.length === 0) {
    throw new ShadowingShapeError("Analysis has no usable chunks.");
  }

  // The annotated line IS the transcript - if the tokens no longer spell it, the
  // learner would be shadowing words the speaker never said.
  const spelled = chunks.flatMap((c) => c.tokens.map((t) => letters(t.w))).filter(Boolean).join(" ");
  const expected = sourceText.split(/\s+/).map(letters).filter(Boolean).join(" ");
  if (spelled !== expected) {
    throw new ShadowingShapeError(`Tokens do not spell the transcript. Got "${spelled}".`);
  }

  return { chunks, notes: normalizeNotes((raw as { notes?: unknown }).notes) };
}
