# PLAN-translate - noda: dịch cả câu sang tiếng Việt

Viết ngày 2026-11-28.

## Vì sao

Owner học các bài khó, học thuật. Khi không hiểu hay không nhớ nghĩa một câu,
owner muốn xem nhanh bản dịch tiếng Việt của câu đó. Một bài 200 câu có thể
cần dịch khoảng 100 câu.

## Quyết định của owner (2026-11-28)

- Dùng ở cả 3 tab: Listen, Shadowing, Dictation (chung một dòng câu).
- **Chủ động chọn**: không bật/tắt, không tự động hiện. Bấm thì dịch đúng một câu.
- Không dùng hover (iPad/phone không có hover, và trái quy tắc "show, don't hide").
- Dictation: chỉ xem được bản dịch **sau khi câu đó đã gõ đúng**.
- Ngôn ngữ: **tiếng Việt, dịch tự nhiên**. Bản đầu chỉ có tiếng Việt.
- Cách B: **dịch 20, hiện 1**. Lần bấm đầu, server dịch câu đó và các câu sau
  (tối đa 20 câu chưa có bản dịch) trong một lần gọi. Màn hình chỉ hiện câu đã
  chọn. Lần bấm sau ở các câu đó thì hiện ngay, không gọi AI.

## Thiết kế

### Giao diện

- Nút **VI** nhỏ, màu xám, trên thanh player, cạnh nút AI. Phím tắt **T**.
- Bấm VI: dịch câu đang phát, hoặc câu vừa nghe/vừa bấm. Muốn dịch câu khác thì
  bấm vào dòng đó trước.
- Bản dịch hiện thành một dòng nhỏ màu xám dưới câu đó, ở yên đó (không chạy
  theo câu đang phát). Bấm VI lại trên câu đó thì ẩn.
- Có thể mở bản dịch ở nhiều câu cùng lúc. Rời bài thì tất cả đóng lại.
- Dictation: câu chưa gõ đúng thì nút VI mờ (disabled).
- Đang tải: dòng "Translating…" dưới câu, chữ VI nhấp nháy.
- Lỗi (hết giới hạn ngày, timeout): một dòng ngắn dưới câu, như word card.
- Focus mode: không có nút VI. Paragraph dictation: bản dịch không hiện (chưa làm).

### Dữ liệu

- Cache mỗi câu một doc: `users/{uid}/lessons/{lessonId}/translations/{sentenceId}`
  `{ en, vi, model, version, createdAt }`.
- Rules: chủ sở hữu đọc được, client không ghi được (chỉ Cloud Function ghi).
- Doc có `en` khác câu hiện tại (transcript đã sửa) thì coi như chưa có.
- Xóa bài: `onLessonDeleted` đã gọi `recursiveDelete`, nên translations tự bị xóa.
- Mở bài: client đọc tất cả translations của bài một lần (một query), để câu đã
  dịch hiện ngay sau khi tải lại trang.

### Server

- Callable mới `translateSentences` (asia-southeast1, một người dùng, giống `defineWord`).
- Input: `lessonId`, `title`, danh sách câu `{ id, text }` cần dịch (tối đa 20),
  và tối đa 2 câu trước làm ngữ cảnh.
- Đọc cache, chỉ gọi Gemini cho câu còn thiếu, ghi cache, trả về tất cả.
- Đếm 1 lần vào giới hạn ngày (`takeAiCall`) cho mỗi lần gọi Gemini thật.
- Model: `getShadowingModelId()` (flash), giống `defineWord`. Temperature 0.2,
  timeout 45s, thinking low (thử 20 câu: khoảng 9 giây, khoảng $0.004 mỗi lần gọi). Kết quả qua `noLongDash` (không có em dash).
- Phần thuần (không firebase) ở `functions/src/lib/translate.ts`: kiểm tra
  request, prompt, đọc kết quả, có test.
- ai-evals: thêm task `translate` vào `upkeep/ai-evals/tasks/noda.ts`.

### Client

- `src/lib/translate.ts` (thuần, có test): chọn nhóm câu cần dịch
  (`pickTranslateBatch`), quy tắc nút có dùng được không (`canTranslate`).
- `src/lib/db/translations.ts`: đọc cache của bài, gọi callable.
- `src/hooks/useSentenceTranslations.ts`: state (bản dịch đã có, câu đang mở,
  loading), phím T.
- `LessonView.tsx` (~508 dòng) và `Player.tsx` (~489 dòng) đã lớn: tách một phần
  ra trước khi thêm.

## Các phase

### T1 - Server

- [x] `functions/src/lib/translate.ts` + test.
- [x] `functions/src/translateSentences.ts`, export trong `index.ts`.
- [x] `firestore.rules`: thêm `translations`.
- [x] ai-evals task `translate`.

### T2 - Client

- [x] Tách `LessonView.tsx` và `Player.tsx` cho gọn.
- [x] `src/lib/translate.ts` + test, `src/lib/db/translations.ts`.
- [x] Hook `useSentenceTranslations`, nút VI, phím T, dòng dịch dưới câu.
- [x] Quy tắc Dictation.

### T3 - Hoàn thiện

- [x] Trang Guide (`src/app/guide/page.tsx`).
- [x] Test (vitest, lint, build).
- [ ] Deploy function + rules, push (chờ owner đồng ý).
