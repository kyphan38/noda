// noda - sentence translation rules (no React, no Firebase).
import type { AppMode, Sentence } from '@/types';

/** One model call covers the asked sentence and the next untranslated ones, up to this many.
 *  Keep in sync with MAX_BATCH in functions/src/lib/translate.ts. */
export const TRANSLATE_BATCH = 20;
const CONTEXT_LINES = 2;
/** Keep in sync with TRANSLATION_VERSION in functions/src/lib/translate.ts. */
export const TRANSLATION_VERSION = 1;

/** Same clean-up as the server, so cached `en` texts match. */
export const cleanSentence = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * The sentence VI acts on: the one playing, else the last one that started. At a sentence's
 * end (the loop pause) the time sits in the gap after it, and that sentence is still the one
 * the learner just heard.
 */
export function pickTargetIndex(transcript: readonly Sentence[], time: number): number {
  let last = -1;
  for (let i = 0; i < transcript.length; i++) {
    const s = transcript[i];
    if (time >= s.start && time < s.end) return i;
    if (s.start <= time) last = i;
  }
  return last;
}

/**
 * The sentence playing, else the last one the learner chose or heard (`followedId`). A row tap
 * seeks a little before its sentence (pre-roll), so the time alone would still point at the
 * one before.
 */
export function resolveTargetIndex(transcript: readonly Sentence[], time: number, followedId: number | null): number {
  const playing = transcript.findIndex((s) => time >= s.start && time < s.end);
  if (playing >= 0) return playing;
  const followed = followedId == null ? -1 : transcript.findIndex((s) => s.id === followedId);
  return followed >= 0 ? followed : pickTargetIndex(transcript, time);
}

/** Dictation shows the meaning only after the line is typed correctly. */
export function canTranslate(mode: AppMode, completedInDictation: boolean): boolean {
  return mode !== 'dictation' || completedInDictation;
}

export type TranslateBatch = {
  items: { id: number; text: string }[];
  context: string[];
};

/**
 * The asked sentence plus the following ones that have no translation yet (`known`) or are not
 * already on the way (`pending`). Null when the asked one needs no call.
 */
export function pickTranslateBatch(
  transcript: readonly Sentence[],
  index: number,
  known: ReadonlySet<number>,
  pending: ReadonlySet<number>,
  size = TRANSLATE_BATCH
): TranslateBatch | null {
  const target = transcript[index];
  if (!target || known.has(target.id) || pending.has(target.id)) return null;
  const items: TranslateBatch['items'] = [];
  for (let i = index; i < transcript.length && items.length < size; i++) {
    const s = transcript[i];
    const text = cleanSentence(s.text);
    if (!text || known.has(s.id) || pending.has(s.id)) continue;
    items.push({ id: s.id, text });
  }
  if (items.length === 0) return null;
  const context = transcript
    .slice(Math.max(0, index - CONTEXT_LINES), index)
    .map((s) => cleanSentence(s.text))
    .filter(Boolean);
  return { items, context };
}

export type CachedTranslationDoc = { en?: unknown; vi?: unknown; version?: unknown };

/** Cached docs that still match the lesson's sentences, as id -> Vietnamese. */
export function usableTranslations(
  docs: ReadonlyArray<{ id: string; data: CachedTranslationDoc }>,
  transcript: readonly Sentence[]
): Map<number, string> {
  const textById = new Map(transcript.map((s) => [s.id, cleanSentence(s.text)]));
  const out = new Map<number, string>();
  for (const { id, data } of docs) {
    const n = Number(id);
    const text = textById.get(n);
    if (text === undefined || data.version !== TRANSLATION_VERSION) continue;
    if (typeof data.en !== 'string' || cleanSentence(data.en) !== text) continue;
    if (typeof data.vi === 'string' && data.vi) out.set(n, data.vi);
  }
  return out;
}

export type TranslationLine =
  | { status: 'loading' }
  | { status: 'ready'; vi: string }
  | { status: 'error'; message: string };

/** What each opened row shows. In Dictation a row that is not (or no longer) done shows nothing. */
export function translationLines(
  open: ReadonlySet<number>,
  known: ReadonlyMap<number, string>,
  errors: ReadonlyMap<number, string>,
  mode: AppMode,
  completed: Readonly<Record<number, boolean>>
): Map<number, TranslationLine> {
  const out = new Map<number, TranslationLine>();
  for (const id of open) {
    if (!canTranslate(mode, !!completed[id])) continue;
    const vi = known.get(id);
    const message = errors.get(id);
    out.set(id, vi ? { status: 'ready', vi } : message ? { status: 'error', message } : { status: 'loading' });
  }
  return out;
}
