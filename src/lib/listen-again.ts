// noda - "Listen again" (N9): lessons worked on, then left alone for a week. Pure.

export const LISTEN_AGAIN_AFTER_DAYS = 7;
export const LISTEN_AGAIN_MIN_PERCENT = 50;
export const LISTEN_AGAIN_MAX = 3;

const DAY_MS = 86_400_000;

export type ListenAgainInput = {
  id: string;
  isTrashed?: boolean;
  lastAccessed: number;
  dictationPercent: number;
  shadowingPercent: number;
};

/** Ids to suggest, the one left longest first. */
export function listenAgainIds(lessons: ListenAgainInput[], now: number): string[] {
  return lessons
    .filter((l) => !l.isTrashed)
    .filter((l) => Math.max(l.dictationPercent, l.shadowingPercent) >= LISTEN_AGAIN_MIN_PERCENT)
    .filter((l) => now - l.lastAccessed >= LISTEN_AGAIN_AFTER_DAYS * DAY_MS)
    .sort((a, b) => a.lastAccessed - b.lastAccessed)
    .slice(0, LISTEN_AGAIN_MAX)
    .map((l) => l.id);
}
