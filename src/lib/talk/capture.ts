// noda - Talk: the "stuck" box. Things you could not say in a real talk,
// saved in a few seconds to practice later. Any language. Pure.

export const MAX_CAPTURE_CHARS = 300;
export const CAPTURE_LIST_SIZE = 20;

export type TalkCapture = { id: string; text: string; createdAt: number; usedInTopicId?: string };

/** Lines not practiced yet, oldest first, as numbered notes for a topic. */
export function capturesToNotes(rows: TalkCapture[]): string {
  return [...rows]
    .filter((r) => !r.usedInTopicId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r, i) => `${i + 1}. ${r.text}`)
    .join('\n');
}

/** One line, trimmed and capped; empty when there is nothing to keep. */
export function cleanCapture(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTURE_CHARS);
}

/** Newest first, capped for the list. */
export function recentCaptures(rows: TalkCapture[], n = CAPTURE_LIST_SIZE): TalkCapture[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, n);
}
