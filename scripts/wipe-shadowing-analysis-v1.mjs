// ---------------------------------------------------------------------------
// noda - delete cached shadowing-pattern analyses from before the current
// analysis version.
//
// v1 stored four independent sections (stress / intonation / connected speech /
// chunking) with their own prose summaries. v2 stores one chunk-and-token
// structure plus a short note list; nothing in a v1 doc can be converted into
// it, so the v1 cache is deleted rather than migrated. Docs are re-created on
// demand the next time that sentence is opened (one paid Gemini call each).
//
// Matching is by the `version` field: anything that is not CURRENT_VERSION is a
// deletion candidate, v1 docs included (they have no `version` field at all).
//
// `--all` ignores the version and deletes every cached analysis. Use it after a
// prompt change that keeps the same shape but produces better content - the docs
// are still "valid", so only a deliberate wipe will refresh them.
//
// Dry run by default; pass --commit to actually delete.
//
//   node --env-file=.env.local scripts/wipe-shadowing-analysis-v1.mjs
//   node --env-file=.env.local scripts/wipe-shadowing-analysis-v1.mjs --commit
//   node --env-file=.env.local scripts/wipe-shadowing-analysis-v1.mjs --all --commit
// ---------------------------------------------------------------------------
import { createRequire } from "module";
import { fileURLToPath } from "url";

// firebase-admin only lives in functions/node_modules (server-only dep); resolve
// it from there, same as the other scripts in this directory.
const functionsRequire = createRequire(
  fileURLToPath(new URL("../functions/package.json", import.meta.url))
);
const { cert, initializeApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");

/** Keep in sync with `SHADOWING_ANALYSIS_VERSION` in types/index.tsx. */
const CURRENT_VERSION = 2;
/** noda owns `(default)` in its own project - see `NODA_DB_ID` in the Cloud Function. */
const DB_ID = "(default)";
const COMMIT = process.argv.includes("--commit");
const ALL = process.argv.includes("--all");

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.\n" +
      "Get a service account key from Console -> Project settings -> Service accounts,\n" +
      "put the three values in .env.local, then re-run with --env-file=.env.local."
  );
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
  projectId,
});
const db = getFirestore(app, DB_ID);

let stale = 0;
let kept = 0;

for (const userRef of await db.collection("users").listDocuments()) {
  for (const lessonRef of await userRef.collection("lessons").listDocuments()) {
    const snap = await lessonRef.collection("shadowingAnalysis").get();
    if (snap.empty) continue;

    const doomed = ALL ? snap.docs : snap.docs.filter((d) => d.data().version !== CURRENT_VERSION);
    kept += snap.size - doomed.length;
    stale += doomed.length;
    if (doomed.length === 0) continue;

    console.log(`users/${userRef.id}/lessons/${lessonRef.id}: ${doomed.length} to delete of ${snap.size}`);
    if (!COMMIT) continue;

    // Small collections (one doc per analyzed sentence), so a single batch per
    // lesson is enough - split if a lesson ever exceeds Firestore's 500-op limit.
    const batch = db.batch();
    for (const doc of doomed) batch.delete(doc.ref);
    await batch.commit();
  }
}

const what = ALL ? "doc(s)" : "stale doc(s)";
console.log(
  COMMIT
    ? `Deleted ${stale} ${what}; kept ${kept}.`
    : `Dry run: would delete ${stale} ${what}; would keep ${kept}.`
);
process.exit(0);
