// ---------------------------------------------------------------------------
// noda - find (and optionally delete) leftovers of lessons that were deleted
// before the onLessonDeleted Cloud Function existed:
//   - Storage objects under users/{uid}/media/ that no lesson's mediaPath uses
//   - Storage objects under users/{uid}/analysis-audio/ whose source media is
//     not used by any lesson
//   - shadowingAnalysis subcollections left under deleted lesson docs
//
// Trashed lessons count as in use (they can still be restored).
//
// Dry run by default; pass --commit to delete. There is no undo.
//
//   node --env-file=.env.local scripts/cleanup-orphan-media.mjs           # dry run
//   node --env-file=.env.local scripts/cleanup-orphan-media.mjs --commit  # delete
// ---------------------------------------------------------------------------
import { createRequire } from "module";
import { fileURLToPath } from "url";

// firebase-admin only lives in functions/node_modules (server-only dep).
const functionsRequire = createRequire(
  fileURLToPath(new URL("../functions/package.json", import.meta.url))
);
const { cert, initializeApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { getStorage } = functionsRequire("firebase-admin/storage");

/** noda owns `(default)` in its own project - see `NODA_DB_ID` in the Cloud Functions. */
const DB_ID = "(default)";
const COMMIT = process.argv.includes("--commit");

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!projectId || !clientEmail || !privateKey || !bucketName) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.\n" +
      "Re-run with --env-file=.env.local."
  );
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
  projectId,
  storageBucket: bucketName,
});
const db = getFirestore(app, DB_ID);
const bucket = getStorage(app).bucket();

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

console.log(`Project ${projectId}, bucket ${bucketName} - ${COMMIT ? "COMMIT (deleting)" : "dry run"}\n`);

let orphanFiles = 0;
let orphanBytes = 0;
let orphanAnalysisDocs = 0;

// Users come from Firestore *and* Storage: once every lesson of a user is gone,
// Firestore no longer lists that user, but their files can still be there.
const uids = new Set((await db.collection("users").listDocuments()).map((ref) => ref.id));
const [allFiles] = await bucket.getFiles({ prefix: "users/" });
for (const f of allFiles) uids.add(f.name.split("/")[1]);

for (const uid of uids) {
  const userRef = db.collection("users").doc(uid);
  const inUse = new Set();
  const deletedLessonRefs = [];

  // listDocuments also returns missing docs that still have subcollections.
  for (const lessonRef of await userRef.collection("lessons").listDocuments()) {
    const snap = await lessonRef.get();
    if (!snap.exists) {
      deletedLessonRefs.push(lessonRef);
      continue;
    }
    const mediaPath = snap.get("mediaPath");
    if (typeof mediaPath === "string") {
      inUse.add(mediaPath);
      const name = mediaPath.split("/").pop();
      inUse.add(`users/${uid}/analysis-audio/${name}.flac`);
    }
  }

  const files = allFiles.filter((f) => f.name.startsWith(`users/${uid}/`));
  const orphans = files.filter(
    (f) =>
      (f.name.startsWith(`users/${uid}/media/`) || f.name.startsWith(`users/${uid}/analysis-audio/`)) &&
      !inUse.has(f.name)
  );

  if (orphans.length === 0 && deletedLessonRefs.length === 0) continue;
  console.log(`users/${uid}: ${inUse.size / 2} lessons with media`);

  for (const f of orphans) {
    const size = Number(f.metadata.size ?? 0);
    console.log(`  file      ${f.name}  (${mb(size)})`);
    orphanBytes += size;
    if (COMMIT) await f.delete({ ignoreNotFound: true });
  }
  for (const ref of deletedLessonRefs) {
    const docs = await ref.collection("shadowingAnalysis").count().get();
    console.log(`  analysis  ${ref.path}/shadowingAnalysis  (${docs.data().count} docs, lesson deleted)`);
    orphanAnalysisDocs += docs.data().count;
    if (COMMIT) await db.recursiveDelete(ref);
  }
  orphanFiles += orphans.length;
}

console.log(
  `\n${COMMIT ? "Deleted" : "Would delete"} ${orphanFiles} file(s), ${mb(orphanBytes)}, ` +
    `and ${orphanAnalysisDocs} cached analysis doc(s) of deleted lessons.` +
    (COMMIT || orphanFiles + orphanAnalysisDocs === 0 ? "" : " Re-run with --commit to delete.")
);
