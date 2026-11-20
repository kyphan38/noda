// noda - Talk: the Learn drill queue. A wrong answer sends the item a few places
// back, so it comes again soon but not at once. Done when the queue is empty. Pure.

export type DrillKind = 'cloze' | 'recall';
export type DrillItem = { phraseId: string; kind: DrillKind };
export type LearnQueue = { items: DrillItem[]; misses: Record<string, number>; done: number; total: number };

/** How far back a missed item goes (or to the end, when the queue is shorter). */
export const MISS_GAP = 3;

/**
 * Two drills per phrase: the blank first (when the example has one), then
 * saying the phrase from its Vietnamese meaning. Blanks for all phrases come
 * before the recall round, so the two drills of one phrase are apart.
 */
export function buildQueue(phrases: { id: string; hasCloze: boolean }[]): LearnQueue {
  const items: DrillItem[] = [
    ...phrases.filter((p) => p.hasCloze).map((p) => ({ phraseId: p.id, kind: 'cloze' as const })),
    ...phrases.map((p) => ({ phraseId: p.id, kind: 'recall' as const })),
  ];
  return { items, misses: {}, done: 0, total: items.length };
}

export function currentItem(q: LearnQueue): DrillItem | null {
  return q.items[0] ?? null;
}

export function answerItem(q: LearnQueue, right: boolean): LearnQueue {
  const [head, ...rest] = q.items;
  if (!head) return q;
  if (right) return { ...q, items: rest, done: q.done + 1 };
  const at = Math.min(MISS_GAP, rest.length);
  return {
    ...q,
    items: [...rest.slice(0, at), head, ...rest.slice(at)],
    misses: { ...q.misses, [head.phraseId]: (q.misses[head.phraseId] ?? 0) + 1 },
  };
}

export function isQueueDone(q: LearnQueue): boolean {
  return q.items.length === 0;
}

/** Fisher-Yates with an injectable random source, so tests are stable. */
export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Matching rounds of up to `size` phrases. A short last round joins the one before. */
export function matchingRounds<T>(items: readonly T[], size = 6): T[][] {
  const rounds: T[][] = [];
  for (let i = 0; i < items.length; i += size) rounds.push(items.slice(i, i + size));
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 3) {
    const last = rounds.pop()!;
    rounds[rounds.length - 1].push(...last);
  }
  return rounds;
}
