// noda - Dictation misses: wrong letters and hints, per sentence. Pure: no React, no Firebase.
// Feeds the slow replay (N4) and the Mistakes page (N1).

/** From this many misses on a sentence, its replays play slower. */
export const SLOW_AFTER_MISSES = 2;
/** Replays of a hard sentence run at this share of the chosen speed. */
export const SLOW_FACTOR = 0.8;

/**
 * Wrong letters typed in this change: letters past the old input that differ
 * from the target. Spaces are not letters. Deleting or retyping a letter the
 * same way counts nothing, so fixing a mistake is never a new one.
 */
export function newWrongLetters(prevAligned: string, nextAligned: string, targetNorm: string): number {
  const prev = prevAligned.replace(/ /g, '');
  const next = nextAligned.replace(/ /g, '');
  const target = targetNorm.replace(/ /g, '');
  let wrong = 0;
  for (let i = prev.length; i < next.length; i++) {
    if (next[i] !== target[i]) wrong++;
  }
  return wrong;
}

/** One sentence on the Mistakes page. */
export type MissItem = { n: number; text: string; start: number; end: number; at: number };

/** users/{uid}/misses/{lessonId} */
export type MissDoc = { lessonId: string; lessonName: string; items: Record<string, MissItem> };

export type MissRow = MissItem & { lessonId: string; lessonName: string; sentenceId: number };

/** Sentences with the most misses across lessons; ties go to the latest miss. Lessons not in `live` are left out. */
export function topMisses(docs: MissDoc[], live: ReadonlySet<string> | null, limit: number): MissRow[] {
  const rows: MissRow[] = [];
  for (const d of docs) {
    if (live && !live.has(d.lessonId)) continue;
    for (const [id, item] of Object.entries(d.items ?? {})) {
      if (!item || !(item.n > 0)) continue;
      rows.push({ ...item, lessonId: d.lessonId, lessonName: d.lessonName, sentenceId: Number(id) });
    }
  }
  return rows.sort((a, b) => b.n - a.n || b.at - a.at).slice(0, limit);
}

/** The target word holding letter `li` (letters only, spaces not counted), or null past the end. */
export function wordAtLetter(targetNorm: string, li: number): string | null {
  let start = 0;
  for (const w of targetNorm.split(' ')) {
    if (li < start + w.length) return li >= start ? w : null;
    start += w.length;
  }
  return null;
}

/** Target words that got a wrong letter in this change, each once. Same rule as newWrongLetters. */
export function wrongWordsInChange(prevAligned: string, nextAligned: string, targetNorm: string): string[] {
  const prev = prevAligned.replace(/ /g, '');
  const next = nextAligned.replace(/ /g, '');
  const target = targetNorm.replace(/ /g, '');
  const words = new Set<string>();
  for (let i = prev.length; i < next.length; i++) {
    if (next[i] === target[i]) continue;
    const w = wordAtLetter(targetNorm, i);
    if (w) words.add(w);
  }
  return [...words];
}
