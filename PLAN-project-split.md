# noda → project riêng `kyphan38-noda-app`

Trạng thái: **chưa làm** (viết 2026-09-02)

Tiếp nối `PLAN-db-split.md`. Lần trước tách **database** (`noda-db`), vẫn chung
project `kyphan38-apps`. Lần này tách hẳn **project**.

Thứ tự trong 4 app: **làm noda cuối cùng**. Đây là ca khó nhất vì có Storage.

---

## 0. Hiện trạng noda

| Mục | Giá trị hiện tại |
| --- | --- |
| Project | `kyphan38-apps` (dùng chung) |
| Database | `noda-db` |
| Dữ liệu | `users/yjzds6g7Y6VjmwtgW4QTnUqaX0F2/lessons` (5 doc) + `shadowingAnalysis` lồng bên trong (24 doc) + `sidebarFolders` |
| Auth | Google, allowlist theo **UID** hoặc email |
| **Storage** | **CÓ** — `users/{uid}/media/...`, bucket `kyphan38-apps.firebasestorage.app` |
| Functions | `analyzeShadowingPattern` — `onCall`, region `us-central1`, secrets `GEMINI_API_KEY` + `ALLOWED_USER_UID` |
| FCM | không dùng |
| Deploy | static export (`output: 'export'`), không có CI, không có Hosting config |
| Indexes | không có composite index nào |

Số liệu Storage đã đếm ngày 2026-09-02, trên bucket dùng chung:

```
81 object, tổng 1175 MB, tất cả nằm dưới users/{uid}/media/
81/81 object đều có download token
```

**Nhưng noda chỉ còn 5 lesson.** Nghĩa là phần lớn trong 81 file là rác của
những lesson đã xoá. Xem bước 6a — chỉ nên chép những file còn được tham chiếu.

---

## 1. Cái bẫy lớn nhất: `mediaUrl`

Mỗi lesson lưu **hai** trường trỏ tới file media (`lib/db.ts:47-58`):

| Trường | Nội dung | Ai dùng |
| --- | --- | --- |
| `mediaPath` | đường dẫn tương đối, ví dụ `users/{uid}/media/173...-clip.mp3` | Cloud Function (`admin.storage().bucket().file(mediaStoragePath)`) |
| `mediaUrl` | **URL đầy đủ** `https://firebasestorage.googleapis.com/v0/b/kyphan38-apps.firebasestorage.app/o/...?alt=media&token=...` | trình phát audio/video ở client |

`getDownloadURL` chỉ được gọi **một lần duy nhất**, lúc upload (`lib/db.ts:237`).
Kết quả được ghi thẳng vào Firestore và **không bao giờ tạo lại**
(`hooks/useLessonLogic.ts:276-282` dùng luôn `lesson.mediaUrl` làm `src`).

Hệ quả: **chép file sang bucket mới là chưa đủ.** URL cũ chứa tên bucket cũ và
token cũ. Chép xong mà không đụng tới `mediaUrl` thì:
- Cloud Function vẫn chạy tốt (nó đi theo `mediaPath`)
- Nhưng **bấm play sẽ không ra tiếng** — và sẽ hỏng vĩnh viễn khi xoá project cũ

### Hai cách chữa

**Cách A — sửa code (nên làm).** Bỏ hẳn việc tin vào `mediaUrl` lưu sẵn. Khi mở
lesson thì gọi `getDownloadURL(ref(storage, lesson.mediaPath))` để lấy URL tươi,
chỉ dùng `mediaUrl` làm dự phòng cho dữ liệu cũ.

- Sửa ở `hooks/useLessonLogic.ts:276-282`.
- Ưu: sau này đổi bucket, đổi project, xoay token — không bao giờ hỏng nữa.
- Nhược: thêm một lượt gọi mạng mỗi lần mở lesson. Với 5 lesson thì không đáng kể.
- Vẫn nên tiếp tục **ghi** `mediaUrl` khi upload, để không phải sửa schema.

**Cách B — viết lại dữ liệu.** Sau khi chép file, sinh URL mới cho từng lesson
rồi `update` lại trường `mediaUrl`.

Chỉ có 5 lesson nên cách B cũng nhanh. Nhưng cách B chỉ chữa lần này; lần sau
đổi gì đó là hỏng lại.

**Khuyến nghị: làm cả hai.** Cách A để hết bệnh, cách B để dữ liệu cũ sạch ngay.

---

## 2. Việc trên Console (làm một lần)

1. Tạo project **`kyphan38-noda-app`**, display name giống ID. Tắt Analytics.
2. Authentication → Sign-in method → bật **Google**.
3. Firestore Database → Create database:
   - Database ID giữ **`(default)`**
   - Location **`asia-southeast1`** — không đổi được về sau
   - **Production mode**
4. **Storage → Get started** → tạo bucket mặc định.
   - Cùng location **`asia-southeast1`**
   - Production mode
   - Tên bucket sẽ là `kyphan38-noda-app.firebasestorage.app`
5. Project settings → Your apps → Add app → **Web**, tên `noda`. Chép 6 giá trị config.
6. Project settings → Service accounts → **Generate new private key** → file JSON.
7. Nâng lên **Blaze**. Bắt buộc: Cloud Functions v2 + Storage đều cần.

---

## 3. Backup

```bash
cd /Users/kyphan/ws/app/noda
git status --short          # phải sạch
cp .env.local /tmp/noda.env.bak
```

Không xoá gì ở project cũ. Dữ liệu và file cũ chính là backup.

---

## 4. Đổi `.env.local`

```
NEXT_PUBLIC_FIREBASE_API_KEY=...              (mới)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kyphan38-noda-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kyphan38-noda-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kyphan38-noda-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...  (mới)
NEXT_PUBLIC_FIREBASE_APP_ID=...               (mới)

NEXT_PUBLIC_ALLOWED_USER_UID=<UID_MỚI>        ← điền ở bước 7
FIREBASE_ADMIN_PROJECT_ID=kyphan38-noda-app
FIREBASE_ADMIN_CLIENT_EMAIL=...   (file JSON mới)
FIREBASE_ADMIN_PRIVATE_KEY="..."  (file JSON mới)
```

`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` lần này **thật sự quan trọng** — noda dùng
Storage. Sai một chữ là upload hỏng.

Mẹo gà-và-trứng: `allowed-user.ts` cho qua khi khớp UID **hoặc** email. Tạm bỏ
dòng `NEXT_PUBLIC_ALLOWED_USER_UID` để đăng nhập lần đầu, lấy UID rồi điền lại.

Ba biến `FIREBASE_ADMIN_*` cũ (service account dùng chung của `kyphan38-apps`)
**giữ lại tạm** dưới tên `OLD_FIREBASE_ADMIN_*` — script copy cần chúng để đọc
nguồn.

---

## 5. Sửa code

| File | Sửa gì |
| --- | --- |
| `.firebaserc:3` | `kyphan38-apps` → `kyphan38-noda-app` |
| `lib/firebase-db-id.ts:13` | `DB_ID = "noda-db"` → `"(default)"`, viết lại comment |
| `functions/src/analyzeShadowingPattern.ts:38` | `NODA_DB_ID = "noda-db"` → `"(default)"` |
| `functions/src/analyzeShadowingPattern.ts:185` | giữ `getFirestore(admin.app(), NODA_DB_ID)` — vẫn đúng |
| `firebase.json` | `firestore` từ **mảng** về **object** |
| `scripts/copy-to-noda-db.mjs` | thay bằng script mới ở bước 6 |
| `hooks/useLessonLogic.ts:276-282` | Cách A ở mục 1 (lấy URL tươi từ `mediaPath`) |
| `README.md` | sửa chỗ nói dùng chung project |

`firebase.json` sau khi sửa:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": { "rules": "storage.rules" },
  "functions": [
    {
      "source": "functions",
      "codebase": "noda",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "*.local"]
    }
  ],
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 },
    "ui": { "enabled": true }
  }
}
```

Hai chỗ ghi `DB_ID` vẫn phải sửa cả hai (app và functions là hai package riêng,
không import nhau được). Đây là điểm đã ghi chú sẵn trong code.

---

## 6. Chép file Storage

### 6a. Chỉ chép file còn dùng

Bucket cũ có 81 object / 1175 MB, nhưng chỉ 5 lesson còn sống. Trước khi chép,
liệt kê `mediaPath` của 5 lesson đó rồi so với danh sách object.

Viết `scripts/list-media-in-use.mjs`: đọc 5 lesson, in ra `mediaPath`, và in ra
những object **không** nằm trong danh sách đó.

- Chép **chỉ những file đang dùng** → nhanh, rẻ, sạch.
- File rác **để nguyên trong bucket cũ**. Không xoá. Đó là backup.
- Nếu về sau tiếc thì vẫn lấy lại được, project cũ còn nguyên.

### 6b. Chép

Dùng `gcloud storage cp`, giữ nguyên đường dẫn tương đối:

```bash
gcloud storage cp \
  gs://kyphan38-apps.firebasestorage.app/users/<UID_CŨ>/media/<tên file> \
  gs://kyphan38-noda-app.firebasestorage.app/users/<UID_MỚI>/media/<tên file>
```

Chú ý: **đường dẫn có chứa UID**, mà UID đổi. Nên đích phải dùng UID mới, và
`mediaPath` trong Firestore cũng phải viết lại theo UID mới. Script ở bước 7 lo
việc này.

Nếu muốn chép cả bucket thì `gcloud storage rsync -r`, nhưng khi đó vẫn phải đổi
đoạn UID trong đường dẫn — không có cách nào tránh.

### 6c. Deploy `storage.rules`

```bash
npx firebase use kyphan38-noda-app
npx firebase deploy --only storage
```

Kiểm tra Console → Storage → Rules: phải thấy `match /users/{userId}/media/{allPaths=**}`.

---

## 7. Chuyển dữ liệu Firestore

### 7a. Lấy UID mới

Tạm bỏ `NEXT_PUBLIC_ALLOWED_USER_UID`, chạy `npm run dev`, đăng nhập
`kyphan.work@gmail.com`. Lấy UID ở Console → Authentication → Users. Điền lại vào `.env.local`.

### 7b. Deploy rules Firestore

```bash
npx firebase deploy --only firestore
```

`firestore.indexes.json` rỗng nên không phải chờ index nào.

Kiểm tra Console → Firestore → Rules: phải thấy `shadowingAnalysis` với
`allow write: if false`.

### 7c. Script copy

Viết `scripts/copy-to-new-project.mjs`, dựa trên `copy-to-noda-db.mjs`. Ba điểm khác:

1. **Hai service account** — nguồn `OLD_FIREBASE_ADMIN_*`, đích `FIREBASE_ADMIN_*`.
2. **Đổi UID** — `--from-uid` / `--to-uid`.
3. **Viết lại `mediaPath` và `mediaUrl`** cho từng lesson:
   - `mediaPath`: thay đoạn `users/<uid cũ>/` bằng `users/<uid mới>/`
   - `mediaUrl`: sinh lại từ bucket mới. Đọc token của object mới bằng Admin SDK
     (`file.getMetadata()` → `metadata.firebaseStorageDownloadTokens`; nếu chưa có
     thì tự đặt một UUID vào đó), rồi ghép:
     ```
     https://firebasestorage.googleapis.com/v0/b/<bucket mới>/o/<encodeURIComponent(path)>?alt=media&token=<token>
     ```
   - Nếu object đích không tồn tại → **báo lỗi và dừng**, đừng ghi URL chết.

Đừng quên **subcollection lồng nhau**: `lessons/{id}/shadowingAnalysis/{id}`.
Script cũ đã xử lý đệ quy, giữ nguyên phần đó.

Chép `lessons` (5) + `shadowingAnalysis` (24) + `sidebarFolders`.
**Không** chép nguyên doc `users/{uid}` — nó từng dùng chung với cogi/logi.

```bash
node --env-file=.env.local scripts/copy-to-new-project.mjs \
  --from-uid yjzds6g7Y6VjmwtgW4QTnUqaX0F2 --to-uid <UID_MỚI>         # dry-run
node --env-file=.env.local scripts/copy-to-new-project.mjs \
  --from-uid ... --to-uid ... --commit                                # ghi thật
```

Mặc định dry-run. Chạy lại dry-run sau khi commit để đối chiếu: 5 + 24 doc.

---

## 8. Deploy Cloud Function

### 8a. Đặt lại secret

Secret **không tự chuyển** sang project mới:

```bash
npx firebase functions:secrets:set GEMINI_API_KEY
npx firebase functions:secrets:set ALLOWED_USER_UID     # ← nhập UID MỚI
```

`ALLOWED_USER_UID` là cửa chặn phía server (`analyzeShadowingPattern.ts:174-177`).
Nhập nhầm UID cũ là mọi lời gọi đều bị từ chối.

### 8b. Deploy

```bash
npx firebase deploy --only functions
```

Lần đầu CLI sẽ hỏi bật Cloud Build, Artifact Registry, Eventarc. Đồng ý hết.

Kiểm tra `npx firebase functions:list` → thấy `analyzeShadowingPattern`,
region **`us-central1`**.

> Region phải khớp với client (`lib/auth/firebase-client.ts:106`). Hàm hiện
> **không đặt region**, nên mặc định là `us-central1`. Đây là dịp tốt để đổi sang
> `asia-southeast1` cho gần — nhưng nếu đổi thì **phải sửa cả hai chỗ cùng lúc**.
> Nếu muốn chắc ăn thì cứ để nguyên `us-central1` lần này, đổi region sau.

### 8c. Kiểm tra function đọc được file

Function gọi `admin.storage().bucket()` không tham số → lấy bucket mặc định của
project đang chạy. Sau khi migrate, đó là bucket mới. Không cần sửa code, nhưng
**phải thử thật**: mở một lesson đã có `shadowingAnalysis` bị xoá, bấm phân tích.

---

## 9. Kiểm tra

```bash
npm run lint
npm run test:unit
npm run build
```

Lưu ý: `test:unit` chỉ chạy 3 file trong `scripts/test-dictation/__tests__/`, không
đụng Firebase. `test:dictation` cũng bỏ qua Firebase vì `NEXT_PUBLIC_E2E_MODE=true`
đi đường tắt. **Test xanh không chứng minh migrate đúng.**

Kiểm tra tay mới là bằng chứng:
- [ ] Đăng nhập Google được, không bị đá ra
- [ ] Sidebar hiện đủ 5 lesson
- [ ] Mở một lesson → **bấm play, phải ra tiếng** (đây là phép thử `mediaUrl`)
- [ ] Nghe chép chính tả (dictation), gõ được, lưu được
- [ ] `completedSentences` / `dictationInputs` cũ vẫn còn
- [ ] Bấm phân tích shadowing → có kết quả (thử cả cache-hit lẫn tính mới)
- [ ] Upload một file media mới → play được ngay
- [ ] Tạo và đổi tên một folder trong sidebar

`npm run test:setup-auth` sẽ phải chạy lại nếu muốn dùng, vì `scripts/.auth.json`
còn giữ phiên đăng nhập của project cũ.

---

## 10. Deploy bản build

Repo này không có Hosting config, không có CI, không có script deploy. Cách bản
`out/` được đưa lên đâu thì **không nằm trong repo**.

- [ ] Tìm lại xem hiện đang publish ở đâu (GitHub Pages? thủ công?)
- [ ] Nếu có host, thêm domain đó vào Firebase Console mới →
      Authentication → Settings → **Authorized domains**
- [ ] Nếu host lưu env var riêng, cập nhật chúng
- [ ] Cân nhắc ghi lại cách deploy vào README, để lần sau khỏi phải đoán

---

## 11. Dọn dẹp (sau 30 ngày chạy ổn)

- [ ] Xoá `scripts/copy-to-noda-db.mjs`, `copy-to-new-project.mjs`, `list-media-in-use.mjs`
- [ ] Trong `kyphan38-apps`: xoá database `noda-db`
- [ ] Xoá `/tmp/noda.env.bak` (có private key)
- [ ] Xoá file JSON service account đã tải
- [ ] Bỏ `OLD_FIREBASE_ADMIN_*` khỏi `.env.local`

**Chỉ sau khi cả 3 app xong** mới tính tới việc xoá project `kyphan38-apps`.
Nhớ là 1175 MB file media rác vẫn nằm đó — xoá project là mất hết. Nếu còn tiếc
thì tải về máy trước.

---

## 12. Checklist

- [ ] 1. Console: tạo project, Auth, Firestore, **Storage**, web app, service account, Blaze
- [ ] 2. Backup `.env.local`
- [ ] 3. Đổi `.env.local` (tạm bỏ ALLOWED_USER_UID, thêm `OLD_FIREBASE_ADMIN_*`)
- [ ] 4. Sửa code (7 file, gồm cả Cách A cho `mediaUrl`)
- [ ] 5. Liệt kê file media còn dùng → chép sang bucket mới → deploy `storage.rules`
- [ ] 6. Đăng nhập lấy UID mới → điền lại `.env`
- [ ] 7. `firebase deploy --only firestore` → chạy script copy (viết lại `mediaPath` + `mediaUrl`) → đối chiếu 5 + 24 doc
- [ ] 8. Đặt lại 2 secret → `firebase deploy --only functions`
- [ ] 9. lint / test / build + **kiểm tra tay, nhất là nút play**
- [ ] 10. Xử lý chỗ deploy bản static
- [ ] 11. Commit (commit thôi, **không push** trừ khi được yêu cầu)
- [ ] 12. Dọn dẹp (sau 30 ngày)
