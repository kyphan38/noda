import type { ShadowingChunk, ShadowingPatternAnalysis } from '@/types';

/**
 * True when this object is shaped like a v2 analysis the panel can render.
 *
 * The callable's result is whatever the DEPLOYED function returned, which is not
 * necessarily the version this client was built against: with a v1 function still
 * live, a cache miss comes back as v1's four-section object and every field the
 * panel reads is undefined. Check the shape at the boundary and surface an error
 * instead - an unexpected payload must not take the whole lesson view down with it.
 */
export function isRenderableAnalysis(value: unknown): value is ShadowingPatternAnalysis {
  if (!value || typeof value !== 'object') return false;
  const { chunks, notes } = value as Partial<ShadowingPatternAnalysis>;
  if (!Array.isArray(chunks) || chunks.length === 0) return false;
  if (notes !== undefined && !Array.isArray(notes)) return false;
  return chunks.every(
    (c) => c && Array.isArray(c.tokens) && c.tokens.length > 0 && c.tokens.every((t) => typeof t?.display === 'string')
  );
}

/** Arrow glyph for a chunk's pitch movement. */
export const TONE_ARROW: Record<ShadowingChunk['tone'], string> = {
  rise: '↗',
  fall: '↘',
  'fall-rise': '↘↗',
  'rise-fall': '↗↘',
  flat: '→',
};

/** Labels for the note badges. */
export const NOTE_LABEL: Record<string, string> = {
  linking: 'linking',
  reduction: 'reduction',
  elision: 'elision',
  assimilation: 'assimilation',
  rhythm: 'rhythm',
};

/**
 * One hue per note type, so a list of up to 6 notes can be scanned by colour instead of
 * read label by label. Written as whole class strings because Tailwind only ships the
 * classes it can see in the source - `bg-${x}-500/15` would compile to nothing.
 */
export const NOTE_BADGE_CLASS: Record<string, string> = {
  linking: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  reduction: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  elision: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  assimilation: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  rhythm: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};
const NOTE_BADGE_FALLBACK = 'bg-gray-700/40 text-gray-300';

export const noteBadgeClass = (type: string): string =>
  NOTE_BADGE_CLASS[type] ?? NOTE_BADGE_FALLBACK;
