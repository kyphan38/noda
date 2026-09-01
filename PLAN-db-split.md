# PLAN - Tách database Firestore (noda)

Ngày viết: 2026-09-01. Trạng thái: **chưa làm**.

Bản song song: `logi/roadmap/PLAN-db-split.md`, `cogi/web/docs/PLAN-db-split.md`.

---

## 0. Vì sao

Ba app **cogi**, **logi**, **noda** dùng chung project `kyphan38-apps` và dùng chung
một database Firestore `(default)`.

Một database chỉ có **một** bộ rules. `firebase deploy --only firestore:rules` thay
toàn bộ bộ rules đó. Ngày 2026-08-26 logi deploy rules → rules của cogi bị xoá sạch →
cogi hỏng nhiều ngày. Lần sau có thể tới lượt noda.

Cách chữa: mỗi app một database riêng. Rules đi theo từng database.

| App  | Database mới |
|------|--------------|
| cogi | `cogi-db`    |
| logi | `logi-db`    |
| noda | `noda-db`    |

`(default)` giữ dữ liệu cũ, khoá deny-all sau khi cả ba app xong.

noda hiện **chưa hỏng**, nên có thể làm sau cùng. Ba app không phụ thuộc nhau.

### Hai xung đột khác, cùng một gốc

1. **Functions**: noda và logi đều ghi `"codebase": "default"` trong `firebase.json`.
   Khi logi deploy functions, CLI thấy `analyzeShadowingPattern` "có trên project
   nhưng không có trong code" và hỏi xoá. Bấm nhầm một lần là mất function của noda.
   **Việc cần làm ngay, không cần chờ chuyển database**: đổi codebase thành `noda`.
   Tài liệu: sau khi mỗi repo có tên codebase riêng, CLI "no longer prompts you to
   delete functions defined outside of your immediate repository"
   (<https://firebase.google.com/docs/functions/organize-functions>).
   Nhân tiện kiểm tra `firebase functions:list` xem `analyzeShadowingPattern` còn sống.
2. **Storage rules**: trước đây cogi cũng deploy `storage.rules` cho cùng một bucket
   (file của cogi là bản chép rules của noda). Theo kế hoạch, cogi bỏ hẳn phần storage
   vì không dùng. Sau đó **noda là chủ duy nhất** của `storage.rules`.

### Giá phải trả

Firestore chỉ cho một database miễn phí mỗi project
(<https://firebase.google.com/docs/firestore/quotas>). Ba database đặt tên nghĩa là cả
ba đều tính tiền. Mức dùng nhỏ, ước tính cả ba dưới 1 USD/tháng. Project đã bật Blaze.

---

## 1. Ba cái bẫy phải nhớ

1. `firebase.json` phải đổi `firestore` từ object sang **mảng**. Viết
   `"database": "(default)"` có ngoặc; viết `"default"` sẽ lỗi 404.
2. Với dạng mảng, `firebase deploy --only firestore:rules` in "Deploy complete!"
   nhưng **không deploy gì cả**
   (<https://github.com/firebase/firebase-tools/issues/10447>).
   Luôn dùng `firebase deploy --only firestore`.
3. Database mới phải **cùng region** với `(default)`. Region không đổi được sau khi
   tạo.

---

## 2. Các bước

### Bước 1 - Tạo database (Console)

Console → Firestore → Databases → Create database.
- Database ID: `noda-db`
- Region: giống hệt `(default)`

### Bước 2 - Sửa `firebase.json`

```json
{
  "firestore": [
    {
      "database": "noda-db",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    }
  ],
  "storage": { "rules": "storage.rules" },
  "functions": [
    {
      "source": "functions",
      "codebase": "noda",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "*.local"]
    }
  ],
  "emulators": { "...": "giữ nguyên" }
}
```

Chỉ đổi hai chỗ: `firestore` thành mảng, và `codebase` thành `noda`.
`firestore.rules` giữ nguyên nội dung.

```bash
firebase deploy --only firestore
```

Chạy trước khi chép dữ liệu, để index kịp build.
Kiểm tra: Console → Firestore → chọn `noda-db` → tab Rules phải thấy
`shadowingAnalysis`. Tab Rules trống thì gần như chắc là dính bẫy số 2.

### Bước 3 - Sửa code phía web

Thêm `lib/firebase-db-id.ts`:

```ts
// Database id của noda trong project kyphan38-apps.
// cogi dùng 'cogi-db', logi dùng 'logi-db'. Xem PLAN-db-split.md.
export const DB_ID = "noda-db";
```

`lib/auth/firebase-client.ts`, hàm `getFirebaseFirestore` (khoảng dòng 88-92):

```ts
cachedFirestore = getFirestore(getFirebaseApp(), DB_ID);
```

`enableIndexedDbPersistence` / `enableMultiTabIndexedDbPersistence` nhận chính
instance đó nên không phải sửa. Nhớ là cache offline gắn với database id: đổi id là
cache thành rỗng, lần mở đầu tiên sẽ tải lại từ mạng. Trước khi cắt chuyển, mở app
lúc có mạng để mọi ghi offline được đẩy lên hết.

Tìm chỗ sót:

```bash
grep -rn "getFirestore(\|initializeFirestore(" lib app components hooks scripts
```

### Bước 4 - Sửa code phía functions

`functions/src/analyzeShadowingPattern.ts` dòng ~178 đang dùng:

```ts
const cacheDocRef = admin.firestore().doc(`users/${uid}/lessons/${lessonId}/shadowingAnalysis/${sentenceId}`);
```

`admin.firestore()` không nhận database id. Đổi sang API mới:

```ts
import { getFirestore } from "firebase-admin/firestore";

const cacheDocRef = getFirestore(admin.app(), "noda-db")
  .doc(`users/${uid}/lessons/${lessonId}/shadowingAnalysis/${sentenceId}`);
```

Chuỗi `"noda-db"` ghi thẳng, vì `functions/` là package riêng, không import được
`lib/`. Thêm comment chỉ về file này.

Comment sẵn có trong file nói `admin.firestore.FieldValue` bị undefined dưới
Functions Emulator - phần đó không đổi, `FieldValue` vẫn import từ
`firebase-admin/firestore` như cũ.

`analyzeShadowingPattern` là `onCall`, không phải Firestore trigger, nên không cần
tuỳ chọn gì thêm. Nếu sau này thêm trigger (`onDocumentWritten`...), **bắt buộc**
truyền `{ database: "noda-db" }`, nếu không trigger sẽ nghe `(default)` và không bao
giờ chạy.

Kiểm tra emulator: bản CLI cũ có thể chưa hỗ trợ database đặt tên. Nếu emulator lỗi,
nâng `firebase-tools` lên bản mới nhất.

### Bước 5 - Chép dữ liệu

Dữ liệu của noda nằm ở `users/{uid}/`:
- `lessons` → mỗi lesson còn subcollection `shadowingAnalysis`
- `sidebarFolders`

**Quan trọng**: `users/{uid}/` trong `(default)` chứa dữ liệu của cả ba app (chung một
UID). Chỉ chép hai collection trên. Không chép đệ quy toàn bộ `users/{uid}`.

Tạo `scripts/copy-to-noda-db.mjs`:

```js
// ---------------------------------------------------------------------------
// noda - Chép dữ liệu từ (default) sang noda-db.
// Mặc định chạy khô. Thêm --commit mới ghi thật. Chạy lại nhiều lần được.
//
//   node --env-file=.env.local scripts/copy-to-noda-db.mjs
//   node --env-file=.env.local scripts/copy-to-noda-db.mjs --commit
// ---------------------------------------------------------------------------
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TARGET_DB = "noda-db";
const COLLECTIONS = ["lessons", "sidebarFolders"];
const COMMIT = process.argv.includes("--commit");

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
});

const src = getFirestore(app);              // (default)
const dst = getFirestore(app, TARGET_DB);   // noda-db

let total = 0;

// Chép một collection, và chép luôn mọi subcollection bên dưới từng doc.
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
  if (snap.exists && COMMIT) {
    await dst.collection("users").doc(userRef.id).set(snap.data(), { merge: true });
  }
  for (const name of COLLECTIONS) {
    await copyCollection(
      userRef.collection(name),
      dst.collection("users").doc(userRef.id).collection(name),
    );
  }
}

console.log(COMMIT ? `Đã ghi ${total} doc.` : `Chạy khô: sẽ ghi ${total} doc.`);
process.exit(0);
```

Script này ghi từng doc một (không dùng batch) vì phải đi xuống subcollection.
Chậm hơn nhưng dữ liệu noda không nhiều. Nếu `lessons` lên tới hàng nghìn doc thì
đổi sang batch cho phần lá.

Cần `FIREBASE_ADMIN_*` trong `.env.local`. noda hiện chỉ có
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, nên có thể phải lấy service account key từ
Console → Project settings → Service accounts. Đừng commit key.

Chạy:

```bash
node --env-file=.env.local scripts/copy-to-noda-db.mjs           # xem số
node --env-file=.env.local scripts/copy-to-noda-db.mjs --commit  # ghi thật
node --env-file=.env.local scripts/copy-to-noda-db.mjs           # chạy lại, so số
```

Số ở lần cuối phải khớp lần đầu. File audio nằm ở Storage, **không** phải chép -
Storage không đổi.

### Bước 6 - Kiểm tra và deploy

```bash
npx tsc --noEmit && npm run lint && npm run test:unit && npm run build
firebase deploy --only functions
```

Lần deploy functions đầu tiên sau khi đổi tên codebase: nếu CLI hỏi xoá
`analyzeShadowingPattern`, **trả lời no**, rồi xem `firebase functions:list`. Đổi tên
codebase chỉ đổi nhãn, không được xoá function.

Thử tay: mở một lesson cũ (đọc `lessons`), kiểm tra sidebar folders, chạy shadowing
analysis một câu đã có cache và một câu chưa có (đường ghi của functions).

### Bước 7 - Khoá `(default)` (do logi làm, khi cả ba app đã xong)

Sau bước đó, chỗ nào còn trỏ `(default)` sẽ hỏng ngay và thấy rõ.
Xoá dữ liệu cũ trong `(default)` để sau vài tuần.

---

## 3. Lỡ hỏng thì lui thế nào

Chưa tới bước 7 thì `git revert` phần sửa code là xong. Dữ liệu trong `(default)` vẫn
nguyên, không bước nào xoá nó.

---

## 4. Checklist

- [ ] Đổi `codebase` thành `noda` (làm ngay được, không cần chờ)
- [ ] `firebase functions:list` - `analyzeShadowingPattern` còn sống
- [ ] Tạo `noda-db`, đúng region với `(default)`
- [ ] `firebase.json`: mảng firestore
- [ ] `firebase deploy --only firestore`, kiểm tra tab Rules của `noda-db`
- [ ] Thêm `firebase-db-id.ts`, sửa `lib/auth/firebase-client.ts`
- [ ] Sửa `functions/src/analyzeShadowingPattern.ts`
- [ ] `grep` lại tìm chỗ sót
- [ ] Lấy service account key nếu `.env.local` chưa có
- [ ] Chạy khô, chép thật, chạy lại đối chiếu
- [ ] typecheck / lint / test / build
- [ ] Deploy functions (không xoá nhầm), deploy web
- [ ] Thử: lesson cũ, sidebar, shadowing analysis (cache và không cache)
- [ ] Xác nhận cogi đã bỏ `storage.rules` - noda là chủ duy nhất
