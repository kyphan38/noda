/**
 * Firestore database id for noda.
 *
 * noda now owns its whole Firebase project (`kyphan38-noda-app`), so it uses
 * the plain `(default)` database again. It previously lived in the shared
 * `kyphan38-apps` project, where each app needed a *named* database
 * (`noda-db`) because a database has exactly one rules file and
 * `firebase deploy --only firestore` from one app would wipe the others'
 * rules. That constraint is gone. See `PLAN-project-split.md`.
 *
 * NOTE: `functions/` is a separate package and cannot import from `lib/`, so it
 * hardcodes the same string - keep `functions/src/analyzeShadowingPattern.ts`
 * in sync when this changes.
 */
export const DB_ID = "(default)";
