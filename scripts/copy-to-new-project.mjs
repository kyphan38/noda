// ---------------------------------------------------------------------------
// noda - chép dữ liệu + file media từ project cũ sang project mới.
//
//   Nguồn: kyphan38-apps      / database 'noda-db'  / bucket kyphan38-apps...
//   Đích:  kyphan38-noda-app  / database '(default)' / bucket kyphan38-noda-app...
//
// UID đổi khi sang project mới, nên phải truyền --from-uid và --to-uid.
// Mặc định chỉ đếm (chạy khô), không ghi gì. Thêm --commit mới ghi thật.
// Chạy lại nhiều lần được: mỗi doc ghi đè theo đúng id, file đã có thì bỏ qua.
//
//   node --env-file=.env.local scripts/copy-to-new-project.mjs \
//     --from-uid <UID_CU> --to-uid <UID_MOI>
//   node --env-file=.env.local scripts/copy-to-new-project.mjs \
//     --from-uid <UID_CU> --to-uid <UID_MOI> --commit
//
// Cờ thêm:
//   --skip-trashed   bỏ qua lesson đang nằm trong thùng rác (isTrashed)
//   --force-media    chép đè file media dù bên đích đã có
//
// VÌ SAO PHỨC TẠP HƠN logi/cogi: noda có Storage. Mỗi lesson giữ hai trường
// trỏ tới file media:
//   - `mediaPath` : đường dẫn tương đối, chứa UID  -> phải đổi UID
//   - `mediaUrl`  : URL đầy đủ, chứa TÊN BUCKET và TOKEN TẢI -> phải sinh lại
// Token tải (`firebaseStorageDownloadTokens`) là metadata của object, KHÔNG đi
// theo file khi chép. Bên đích phải tự đặt token mới rồi ghép lại URL. Chép
// file mà quên viết lại `mediaUrl` thì app mới vẫn phát được tiếng - nhưng là
// đang phát từ bucket CŨ, và sẽ chết hẳn lúc xoá project cũ.
//
// Credential nguồn: OLD_FIREBASE_ADMIN_*, không có thì đọc /tmp/noda.env.bak.
//
// Xem PLAN-project-split.md, bước 6 và 7.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const functionsRequire = createRequire(
  fileURLToPath(new URL("../functions/package.json", import.meta.url))
);
const { cert, initializeApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { getStorage } = functionsRequire("firebase-admin/storage");

const SOURCE_DB = "noda-db";
const COLLECTIONS = ["lessons", "sidebarFolders"];
const OLD_ENV_BACKUP = process.env.OLD_ENV_FILE ?? "/tmp/noda.env.bak";

const COMMIT = process.argv.includes("--commit");
const SKIP_TRASHED = process.argv.includes("--skip-trashed");
const FORCE_MEDIA = process.argv.includes("--force-media");

const flag = (name) => {
  const i = process.argv.indexOf(name);
  const v = i === -1 ? null : process.argv[i + 1];
  if (!v || v.startsWith("--")) throw new Error(`Thiếu ${name} <uid>`);
  return v;
};

const FROM_UID = flag("--from-uid");
const TO_UID = flag("--to-uid");

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường ${name} (xem .env.local)`);
  return v;
};

// --- Credential của project cũ ---------------------------------------------
function readOldEnv() {
  const keys = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
  ];
  const fromEnv = {};
  for (const k of keys) {
    const v = process.env[`OLD_${k}`];
    if (v) fromEnv[k] = v;
  }
  if (keys.every((k) => fromEnv[k])) return fromEnv;

  let text;
  try {
    text = readFileSync(OLD_ENV_BACKUP, "utf8");
  } catch {
    throw new Error(
      `Không đọc được ${OLD_ENV_BACKUP}. Đặt OLD_FIREBASE_ADMIN_* hoặc OLD_ENV_FILE.`
    );
  }
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || !keys.includes(m[1])) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  for (const k of keys) if (!out[k]) throw new Error(`${OLD_ENV_BACKUP} thiếu ${k}`);
  return out;
}

const old = readOldEnv();

if (old.FIREBASE_ADMIN_PROJECT_ID === process.env.FIREBASE_ADMIN_PROJECT_ID) {
  throw new Error(
    "Project nguồn và đích trùng nhau. .env.local phải trỏ tới project MỚI, " +
      "còn OLD_FIREBASE_ADMIN_* giữ credential project CŨ."
  );
}
if (FROM_UID === TO_UID) {
  console.warn("! Cảnh báo: --from-uid và --to-uid giống nhau. Chắc chưa?\n");
}

const SRC_BUCKET =
  process.env.OLD_FIREBASE_STORAGE_BUCKET ??
  `${old.FIREBASE_ADMIN_PROJECT_ID}.firebasestorage.app`;
const DST_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  `${need("FIREBASE_ADMIN_PROJECT_ID")}.firebasestorage.app`;

const srcApp = initializeApp(
  {
    credential: cert({
      projectId: old.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: old.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: old.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    projectId: old.FIREBASE_ADMIN_PROJECT_ID,
    storageBucket: SRC_BUCKET,
  },
  "source"
);

const dstApp = initializeApp(
  {
    credential: cert({
      projectId: need("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: need("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: need("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    projectId: need("FIREBASE_ADMIN_PROJECT_ID"),
    storageBucket: DST_BUCKET,
  },
  "target"
);

const src = getFirestore(srcApp, SOURCE_DB);
const dst = getFirestore(dstApp); // (default)
const srcBucket = getStorage(srcApp).bucket(SRC_BUCKET);
const dstBucket = getStorage(dstApp).bucket(DST_BUCKET);

const mb = (b) => (Number(b) / 1024 / 1024).toFixed(1);

console.log(`Nguồn: ${old.FIREBASE_ADMIN_PROJECT_ID} / ${SOURCE_DB} / users/${FROM_UID}`);
console.log(`       gs://${SRC_BUCKET}`);
console.log(`Đích:  ${process.env.FIREBASE_ADMIN_PROJECT_ID} / (default) / users/${TO_UID}`);
console.log(`       gs://${DST_BUCKET}`);
console.log(COMMIT ? "Chế độ: GHI THẬT\n" : "Chế độ: chạy khô (thêm --commit để ghi)\n");

const srcUser = src.collection("users").doc(FROM_UID);
const dstUser = dst.collection("users").doc(TO_UID);

// ---------------------------------------------------------------------------
// GIAI ĐOẠN 1 - đọc lesson, quyết định file media nào phải chép
// ---------------------------------------------------------------------------
const lessonsSnap = await srcUser.collection("lessons").get();

const rewritePath = (p) =>
  p.startsWith(`users/${FROM_UID}/`) ? `users/${TO_UID}/${p.slice(`users/${FROM_UID}/`.length)}` : p;

const plan = [];
for (const doc of lessonsSnap.docs) {
  const data = doc.data();
  const trashed = data.isTrashed === true;
  if (SKIP_TRASHED && trashed) {
    console.log(`  bỏ qua (thùng rác): ${doc.id} ${data.name ?? ""}`);
    continue;
  }
  plan.push({
    id: doc.id,
    doc,
    data,
    trashed,
    srcPath: data.mediaPath ?? null,
    dstPath: data.mediaPath ? rewritePath(data.mediaPath) : null,
  });
}

console.log("GIAI ĐOẠN 1 - file media");
const mediaJobs = plan.filter((p) => p.srcPath);
let copied = 0;
let reused = 0;
let bytes = 0;

for (const job of mediaJobs) {
  const srcFile = srcBucket.file(job.srcPath);
  const [exists] = await srcFile.exists();
  if (!exists) {
    throw new Error(
      `File nguồn không tồn tại: gs://${SRC_BUCKET}/${job.srcPath}\n` +
        `  (lesson ${job.id}). Dừng lại, không ghi URL chết.`
    );
  }
  const [meta] = await srcFile.getMetadata();
  const dstFile = dstBucket.file(job.dstPath);
  const [dstExists] = await dstFile.exists();

  bytes += Number(meta.size ?? 0);

  if (dstExists && !FORCE_MEDIA) {
    reused += 1;
    console.log(`  = đã có   ${mb(meta.size).padStart(7)} MB  ${job.dstPath}`);
  } else {
    copied += 1;
    console.log(`  ${COMMIT ? "+ chép  " : "~ sẽ chép"} ${mb(meta.size).padStart(7)} MB  ${job.dstPath}`);
    if (COMMIT) {
      // Chép qua stream: nguồn và đích là hai project khác nhau, hai credential
      // khác nhau, nên không dùng được server-side copy của GCS.
      await pipeline(
        srcFile.createReadStream(),
        dstFile.createWriteStream({
          resumable: false,
          metadata: {
            contentType: meta.contentType ?? "application/octet-stream",
            cacheControl: meta.cacheControl ?? undefined,
          },
        })
      );
    }
  }

  // Token tải: KHÔNG đi theo file. Bên đích phải có token riêng thì URL
  // ?alt=media&token=... mới đọc được mà không cần đăng nhập.
  let token = null;
  if (COMMIT) {
    const [dstMeta] = await dstFile.getMetadata();
    token = dstMeta.metadata?.firebaseStorageDownloadTokens ?? null;
    if (!token) {
      token = randomUUID();
      await dstFile.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      console.log(`      token mới: ${token}`);
    } else {
      console.log(`      token sẵn có: ${token}`);
    }
  }
  job.token = token;
  job.newUrl = token
    ? `https://firebasestorage.googleapis.com/v0/b/${DST_BUCKET}/o/${encodeURIComponent(job.dstPath)}?alt=media&token=${token}`
    : null;
}

console.log(
  `  -> ${mediaJobs.length} file (${mb(bytes)} MB): ${copied} chép mới, ${reused} đã có, ` +
    `${plan.length - mediaJobs.length} lesson không có media\n`
);

// ---------------------------------------------------------------------------
// GIAI ĐOẠN 2 - Firestore
// ---------------------------------------------------------------------------
console.log("GIAI ĐOẠN 2 - Firestore");

let total = 0;
const counts = {};

/** Chép một collection, đệ quy vào mọi subcollection.
 * Không dùng batch: batch không diễn tả được "rồi đi tiếp vào subcollection
 * của doc này", mà noda thì ít doc. `transform` để viết lại mediaPath/mediaUrl. */
async function copyCollection(fromCol, toCol, transform = null, only = null) {
  const snap = await fromCol.get();
  const docs = only ? snap.docs.filter((d) => only.has(d.id)) : snap.docs;
  if (docs.length > 0) {
    const label = fromCol.id;
    counts[label] = (counts[label] ?? 0) + docs.length;
    console.log(`  ${fromCol.path.replace(FROM_UID, "{uid}")}: ${docs.length} doc`);
  }
  for (const doc of docs) {
    const data = transform ? transform(doc) : doc.data();
    if (COMMIT) await toCol.doc(doc.id).set(data);
    total += 1;
    for (const sub of await doc.ref.listCollections()) {
      await copyCollection(sub, toCol.doc(doc.id).collection(sub.id));
    }
  }
}

const byId = new Map(plan.map((p) => [p.id, p]));

const lessonTransform = (doc) => {
  const job = byId.get(doc.id);
  const data = { ...doc.data() };
  if (!job?.srcPath) return data;
  data.mediaPath = job.dstPath;
  if (COMMIT) {
    if (!job.newUrl) {
      throw new Error(`Lesson ${doc.id}: chưa sinh được mediaUrl mới. Dừng.`);
    }
    data.mediaUrl = job.newUrl;
  }
  return data;
};

await copyCollection(
  srcUser.collection("lessons"),
  dstUser.collection("lessons"),
  lessonTransform,
  new Set(plan.map((p) => p.id))
);
await copyCollection(srcUser.collection("sidebarFolders"), dstUser.collection("sidebarFolders"));

// Cố tình KHÔNG chép doc gốc users/{uid}: nó từng dùng chung với cogi/logi.
console.log(`  (bỏ qua doc gốc users/{uid} - từng dùng chung với cogi/logi)`);

console.log("\nTổng kết");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v} doc`);
console.log(`  ${"TỔNG".padEnd(20)} ${total} doc`);
console.log(`  ${"media".padEnd(20)} ${mediaJobs.length} file (${mb(bytes)} MB)`);

if (COMMIT) {
  console.log(`\nĐã ghi ${total} doc và ${copied} file.`);
  console.log("mediaUrl đã trỏ sang bucket mới. Nhớ bấm play thử trên app thật.");
} else {
  console.log(`\nChạy khô: sẽ ghi ${total} doc và chép ${copied} file.`);
  console.log("Thêm --commit để ghi thật.");
}
process.exit(0);
