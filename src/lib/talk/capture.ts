// noda - Talk: the "stuck" box. Things you could not say in a real talk,
// saved in a few seconds to practice later. Any language. Pure.

export const MAX_CAPTURE_CHARS = 300;
export const CAPTURE_LIST_SIZE = 20;

export type TalkCapture = { id: string; text: string; createdAt: number; usedInSessionId?: string };

/** One line, trimmed and capped; empty when there is nothing to keep. */
export function cleanCapture(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTURE_CHARS);
}

/** Newest first, capped for the list. */
export function recentCaptures(rows: TalkCapture[], n = CAPTURE_LIST_SIZE): TalkCapture[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, n);
}
