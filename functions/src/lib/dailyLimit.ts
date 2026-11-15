/**
 * Daily cap on Gemini calls, a guard against runaway loops (auto-analyze, retries).
 * Counted only on real model calls: cached analyses are free.
 * Stored at users/{uid}/meta/aiUsage; firestore.rules give the client no access to it.
 */
import type { Firestore } from "firebase-admin/firestore";

export const AI_DAILY_LIMIT = 200;

export type AiUsage = { day: string; count: number };

/** Day in Vietnam time, so the counter resets at local midnight. */
export function usageDay(now: number): string {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function nextAiUsage(
  prev: Partial<AiUsage> | undefined,
  now: number,
  max: number
): { allowed: boolean; usage: AiUsage } {
  const day = usageDay(now);
  const count = prev?.day === day && typeof prev.count === "number" ? prev.count : 0;
  if (count >= max) return { allowed: false, usage: { day, count } };
  return { allowed: true, usage: { day, count: count + 1 } };
}

/** Counts one call for today; false when the cap is reached. */
export async function takeAiCall(db: Firestore, uid: string, now = Date.now()): Promise<boolean> {
  const ref = db.doc(`users/${uid}/meta/aiUsage`);
  return db.runTransaction(async (tx) => {
    const next = nextAiUsage((await tx.get(ref)).data(), now, AI_DAILY_LIMIT);
    if (next.allowed) tx.set(ref, next.usage);
    return next.allowed;
  });
}
