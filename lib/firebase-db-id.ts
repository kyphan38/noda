/**
 * Firestore database id for noda inside the shared `kyphan38-apps` project.
 *
 * cogi / logi / noda share one project but each owns a named database, because
 * a database has exactly one rules file and `firebase deploy --only firestore`
 * from one app would otherwise wipe the other apps' rules. cogi uses `cogi-db`,
 * logi uses `logi-db`. See `PLAN-db-split.md`.
 *
 * NOTE: `functions/` is a separate package and cannot import from `lib/`, so it
 * hardcodes the same string - keep `functions/src/analyzeShadowingPattern.ts`
 * in sync when this changes.
 */
export const DB_ID = "noda-db";
