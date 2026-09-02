// ---------------------------------------------------------------------------
// noda - liệt kê file media còn được lesson tham chiếu, và file rác.
//
// Bucket dùng chung có ~81 object / ~1175 MB, nhưng noda chỉ còn vài lesson.
// Phần lớn object là rác của lesson đã xoá. Script này đọc `mediaPath` của
// từng lesson trong `noda-db` rồi so với danh sách object thật trong bucket.
//
// Chỉ đọc, không ghi, không xoá gì cả.
//
//   node --env-file=.env.local scripts/list-media-in-use.mjs
//   node --env-file=.env.local scripts/list-media-in-use.mjs --json
//
// Xem PLAN-project-split.md, bước 6a.
// ---------------------------------------------------------------------------
import { createRequire } from "module";
import { fileURLToPath } from "url";

const functionsRequire = createRequire(
  fileURLToPath(new URL("../functions/package.json", import.meta.url))
);
const { cert, initializeApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { getStorage } = functionsRequire("firebase-admin/storage");

const SOURCE_DB = process.env.SOURCE_DB_ID ?? "noda-db";
const AS_JSON = process.argv.includes("--json");
const UID = process.env.SOURCE_UID ?? "yjzds6g7Y6VjmwtgW4QTnUqaX0F2";

// Credential của project nguồn: ưu tiên OLD_*, không có thì dùng bản thường.
const pick = (name) => process.env[`OLD_${name}`] || process.env[name];
const projectId = pick("FIREBASE_ADMIN_PROJECT_ID");
const clientEmail = pick("FIREBASE_ADMIN_CLIENT_EMAIL");
const privateKey = pick("FIREBASE_ADMIN_PRIVATE_KEY");
const bucketName =
  process.env.OLD_FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Thiếu FIREBASE_ADMIN_* (hoặc OLD_FIREBASE_ADMIN_*) trong .env.local");
  process.exit(1);
}

const app = initializeApp(
  {
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
    projectId,
    storageBucket: bucketName,
  },
  "inventory"
);

const db = getFirestore(app, SOURCE_DB);
const bucket = getStorage(app).bucket(bucketName);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

const userRef = db.collection("users").doc(UID);

// --- Firestore: lesson + mediaPath ------------------------------------------
const lessonsSnap = await userRef.collection("lessons").get();
const lessons = [];
let analysisTotal = 0;

for (const doc of lessonsSnap.docs) {
  const data = doc.data();
  const analysisSnap = await doc.ref.collection("shadowingAnalysis").get();
  analysisTotal += analysisSnap.size;
  lessons.push({
    id: doc.id,
    name: data.name ?? "(không tên)",
    mediaPath: data.mediaPath ?? null,
    mediaUrl: data.mediaUrl ?? null,
    mediaSizeBytes: data.mediaSizeBytes ?? null,
    isTrashed: data.isTrashed === true,
    shadowingAnalysis: analysisSnap.size,
  });
}

const foldersSnap = await userRef.collection("sidebarFolders").get();

// --- Storage: object thật trong bucket ---------------------------------------
const prefix = `users/${UID}/media/`;
const [files] = await bucket.getFiles({ prefix });

const inUse = new Set(lessons.map((l) => l.mediaPath).filter(Boolean));
const present = new Map(files.map((f) => [f.name, f]));

const found = [];
const missing = [];
for (const p of inUse) {
  const f = present.get(p);
  if (f) found.push(f);
  else missing.push(p);
}
const orphans = files.filter((f) => !inUse.has(f.name));

const sum = (arr) => arr.reduce((n, f) => n + Number(f.metadata.size ?? 0), 0);
const hasToken = (f) => Boolean(f.metadata?.metadata?.firebaseStorageDownloadTokens);

if (AS_JSON) {
  console.log(
    JSON.stringify(
      { uid: UID, bucket: bucketName, lessons, inUse: found.map((f) => f.name), missing,
        orphans: orphans.map((f) => f.name) },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(`Project : ${projectId}`);
console.log(`Database: ${SOURCE_DB}`);
console.log(`Bucket  : gs://${bucketName}`);
console.log(`User    : ${UID}\n`);

console.log(`Firestore`);
console.log(`  lessons          : ${lessonsSnap.size} doc`);
console.log(`  shadowingAnalysis: ${analysisTotal} doc (lồng trong lessons)`);
console.log(`  sidebarFolders   : ${foldersSnap.size} doc`);
console.log(`  TỔNG             : ${lessonsSnap.size + analysisTotal + foldersSnap.size} doc\n`);

console.log(`Lesson và media`);
for (const l of lessons) {
  const f = l.mediaPath ? present.get(l.mediaPath) : null;
  const state = !l.mediaPath ? "KHÔNG có media" : f ? `${mb(f.metadata.size)} MB` : "!! THIẾU FILE";
  const urlBucket = l.mediaUrl?.match(/\/v0\/b\/([^/]+)\//)?.[1] ?? "-";
  console.log(`  ${l.id}  ${state.padEnd(14)}  analysis=${String(l.shadowingAnalysis).padStart(2)}  ${l.isTrashed ? "[thùng rác] " : ""}${l.name}`);
  console.log(`      mediaPath: ${l.mediaPath ?? "-"}`);
  console.log(`      mediaUrl bucket: ${urlBucket}`);
}

console.log(`\nStorage dưới ${prefix}`);
console.log(`  tổng object   : ${files.length} (${mb(sum(files))} MB)`);
console.log(`  ĐANG DÙNG     : ${found.length} (${mb(sum(found))} MB)  ← chỉ chép ngần này`);
console.log(`  rác (bỏ lại)  : ${orphans.length} (${mb(sum(orphans))} MB)`);
console.log(`  thiếu file    : ${missing.length}`);
console.log(`  có token tải  : ${found.filter(hasToken).length}/${found.length} file đang dùng`);

if (missing.length) {
  console.log(`\n!! Lesson trỏ tới file không tồn tại:`);
  for (const p of missing) console.log(`   ${p}`);
}

console.log(`\nFile sẽ chép sang bucket mới:`);
for (const f of found) {
  console.log(`  ${mb(f.metadata.size).padStart(7)} MB  ${f.name}`);
}

process.exit(0);
