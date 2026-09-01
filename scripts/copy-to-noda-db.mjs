// ---------------------------------------------------------------------------
// noda - copy data from the `(default)` Firestore database into `noda-db`.
//
// Dry run by default; pass --commit to actually write. Safe to re-run: every
// write is an idempotent set() keyed by the source doc id, so a second pass
// overwrites with identical data rather than duplicating.
//
// Only `users/{uid}/lessons` (plus its `shadowingAnalysis` subcollections) and
// `users/{uid}/sidebarFolders` are copied. `users/{uid}` in `(default)` is
// shared with cogi and logi under the same UID, so nothing else is touched.
// Audio lives in Cloud Storage, which is not affected by the database split.
//
// Needs FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY in .env.local
// (Console -> Project settings -> Service accounts). Never commit that key.
//
//   node --env-file=.env.local scripts/copy-to-noda-db.mjs           # dry run
//   node --env-file=.env.local scripts/copy-to-noda-db.mjs --commit  # write
//
// See PLAN-db-split.md, step 5.
// ---------------------------------------------------------------------------
import { createRequire } from "module";
import { fileURLToPath } from "url";

// firebase-admin only lives in functions/node_modules (server-only dep); resolve
// it from there, same as scripts/smoke-test-frontend-callable.mjs.
const functionsRequire = createRequire(
  fileURLToPath(new URL("../functions/package.json", import.meta.url))
);
const { cert, initializeApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");

const TARGET_DB = "noda-db";
const COLLECTIONS = ["lessons", "sidebarFolders"];
const COMMIT = process.argv.includes("--commit");

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
  credential: cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }),
  projectId,
});

const src = getFirestore(app); // (default)
const dst = getFirestore(app, TARGET_DB); // noda-db

let total = 0;

/** Copy one collection doc-by-doc, recursing into every subcollection.
 * Not batched: batches cannot express "then walk this doc's subcollections",
 * and noda's document count is small. Switch the leaves to batched writes if
 * `lessons` ever grows into the thousands. */
async function copyCollection(fromCol, toCol) {
  const snap = await fromCol.get();
  if (snap.size > 0) console.log(`  ${fromCol.path}: ${snap.size} doc`);
  for (const doc of snap.docs) {
    if (COMMIT) await toCol.doc(doc.id).set(doc.data());
    total += 1;
    for (const sub of await doc.ref.listCollections()) {
      await copyCollection(sub, toCol.doc(doc.id).collection(sub.id));
    }
  }
}

for (const userRef of await src.collection("users").listDocuments()) {
  console.log(`users/${userRef.id}`);
  const snap = await userRef.get();
  // merge: the user doc is shared with cogi/logi, so never clobber their fields.
  if (snap.exists && COMMIT) {
    await dst.collection("users").doc(userRef.id).set(snap.data(), { merge: true });
  }
  for (const name of COLLECTIONS) {
    await copyCollection(
      userRef.collection(name),
      dst.collection("users").doc(userRef.id).collection(name)
    );
  }
}

console.log(COMMIT ? `Wrote ${total} doc(s).` : `Dry run: would write ${total} doc(s).`);
process.exit(0);
