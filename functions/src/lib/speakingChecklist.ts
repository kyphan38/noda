/**
 * The sound habits a speaking check asks about, taken from the cached shadowing
 * analysis of the segment's sentences. No imports, so the app's vitest suite can load it.
 */

export interface SpeakingChecklistItem {
  type: string;
  text: string;
  sounds: string;
  via: string;
}

/** Most sound notes a segment sends; more makes the reply slower and less careful. */
export const MAX_CHECKS = 10;

/**
 * Sound notes (not rhythm) of each sentence. When there are more than `max`, they are
 * taken in turns from each sentence (first note of every sentence, then the second, ...)
 * so the end of the segment is checked too, then put back in sentence order.
 * `docs` holds one analysis doc per sentence, in order; a missing or stale one gives nothing.
 */
export function buildChecklist(
  docs: Array<Record<string, unknown> | undefined>,
  analysisVersion: number,
  max = MAX_CHECKS
): SpeakingChecklistItem[] {
  const perSentence = docs.map((doc) => {
    if (!doc || doc.version !== analysisVersion) return [];
    const notes = (doc.analysis as { notes?: unknown } | undefined)?.notes;
    if (!Array.isArray(notes)) return [];
    const items: SpeakingChecklistItem[] = [];
    for (const n of notes) {
      if (!n || typeof n !== "object") continue;
      const note = n as Record<string, unknown>;
      if (note.type === "rhythm" || typeof note.text !== "string" || !note.text.trim()) continue;
      items.push({
        type: String(note.type),
        text: note.text,
        sounds: typeof note.sounds === "string" ? note.sounds : "",
        via: typeof note.via === "string" ? note.via : "",
      });
    }
    return items;
  });

  const picked: Array<{ s: number; n: number }> = [];
  const longest = Math.max(0, ...perSentence.map((l) => l.length));
  for (let n = 0; n < longest && picked.length < max; n++) {
    for (let s = 0; s < perSentence.length && picked.length < max; s++) {
      if (n < perSentence[s].length) picked.push({ s, n });
    }
  }
  picked.sort((a, b) => a.s - b.s || a.n - b.n);
  return picked.map(({ s, n }) => perSentence[s][n]);
}
