# Plan: progress tracking, UI/UX, AI, xoá Decks

Viết ngày 2026-10-01. Làm theo thứ tự các phase bên dưới. Mỗi phase là một
(hoặc vài) commit riêng. Các quyết định lớn đã chốt ngày 2026-10-01 (ghi "Đã chọn"). Quyết định mới phát sinh thì hỏi trước.

---

## Phase 0 - Xoá Decks (flashcard) - XONG

Lý do làm trước: bỏ Decks giúp code gọn hơn, các phase sau sửa ít file hơn.

Hiện trạng: deck được lưu như một lesson có `type: 'flashcard'` trong Firestore
(`users/{uid}/lessons`). Code deck nằm ở khoảng 28 file.

Việc cần làm:
- Xoá file: `DeckCard.tsx`, `NewDeckModal.tsx`, `FlashcardViewer.tsx`,
  `hooks/useFlashcardEngine.ts`, `lib/flashcard-shuffle.ts`.
- Bỏ deck khỏi: `Sidebar.tsx` (section DECKS, nút `+ Deck`), `SidebarFolderTree.tsx`,
  `SidebarSection.tsx`, `SidebarFolderRow.tsx`, `WelcomeScreen.tsx`, `EmptyState.tsx`,
  `TrashCard.tsx`, `CleanupModal.tsx` (biến thể "Deck complete"), `AppHeader.tsx`,
  `LoadingSkeleton.tsx`, `DeleteLessonModal.tsx`, `DeleteManyModal.tsx`, `UploadPanel.tsx`.
- Bỏ khỏi type: `DeckItem`, `AppMode` giá trị `'flashcard'`, `ContentType` `'deck'`,
  `FlashcardData`, các field `kind`/`type: 'flashcard'`.
- Bỏ hàm deck trong `lib/db.ts`, `lib/item-url.ts`, `lib/utils.ts`, `constants/index.tsx`,
  hook `useLessonLogic`, `useLessonCreateFlow`, `useGlobalPlaybackShortcuts`,
  `useDictationCompletionModal`, và CSS flashcard trong `app/globals.css`.
- Kiểm tra: `npm run lint`, `npm run test:unit`, `npm run build`.

Đã chọn: **xoá hẳn** dữ liệu deck khỏi Firestore (cả bản trong Trash).

**Xong (2026-10-01), branch `feat/remove-decks`.** Đã kiểm tra Firestore: chỉ có
12 bài audio, 0 deck, 0 thư mục deck. Vì vậy không cần script xoá dữ liệu.

---

## Phase 1 - Sửa phần tích hợp AI (shadowing analysis) - XONG

**Xong (2026-10-01).** A1, A2, A3, A5 đã merge vào main; Cloud Function đã deploy.
A4 để lại (chưa cần, vì app chưa cho sửa transcript).

Điểm đang tốt (giữ nguyên): cache-first trong Firestore, hỏi xác nhận trước khi
gọi Gemini (tốn tiền), structured output + kiểm tra shape, retry một lần khi JSON
hỏng, prefetch 2 câu tiếp theo nhưng không lan dây chuyền, chỉ cho một user gọi.

Cần sửa:

- **A1. Bug khi đổi bài giữa chừng** (`hooks/useShadowingPatternManager.ts`).
  Khi đổi lesson, `loadingIdsRef` không được xoá, và các request đang chạy vẫn gọi
  `setEntry` khi xong. Sentence id bắt đầu từ 1 ở mọi bài, nên:
  - Kết quả của bài A có thể hiện ở câu cùng số của bài B.
  - Bấm câu 3 ở bài B có thể bị kẹt "loading" vì id 3 vẫn nằm trong `loadingIdsRef`.
  Cách sửa: key theo `lessonId:sentenceId`, hoặc giữ một `lessonIdRef` và bỏ qua
  kết quả nếu lesson đã đổi; xoá `loadingIdsRef` khi đổi bài. Thêm unit test.

- **A2. Tải cả file media cho mỗi câu** (`functions/src/analyzeShadowingPattern.ts`).
  Mỗi lần cache miss, function tải toàn bộ file (video có thể hàng trăm MB) chỉ để
  cắt vài giây. Prefetch 2 câu nghĩa là 3 lần tải song song. Chậm và tốn băng thông.
  Đã chọn: **tạo file audio nhỏ khi upload**.
  - Khi upload, tạo thêm file audio-only nhỏ (mono, bitrate thấp) và lưu đường dẫn
    vào lesson doc (ví dụ `analysisAudioPath`). Function ưu tiên tải file này.
  - Nếu bài chưa có file nhỏ, function dùng file gốc như cũ (không vỡ bài cũ).
  - Viết script chạy một lần để tạo file nhỏ cho các bài cũ.
  - Cần quyết định khi làm: tạo file trên trình duyệt (ffmpeg.wasm, nặng) hay bằng
    một Cloud Function chạy khi có file mới trong Storage (gọn hơn). Hỏi trước.

- **A3. SDK cũ.** `@google/generative-ai` đã bị Google ngừng phát triển, thay bằng
  `@google/genai`. Nên chuyển (đổi `geminiClient.ts` và schema trong prompt).
  Làm cùng lúc cho cogi nếu cogi cũng dùng SDK cũ.

- **A4. Cache không kiểm tra nội dung câu.** Cache chỉ theo `sentenceId`. Hiện app
  chưa cho sửa transcript nên rủi ro thấp. Nếu sau này thêm sửa transcript, so sánh
  `sourceText` với cache trước khi trả về.

- **A5. Code chết.** `hooks/useSpeechRecognition.ts` không được dùng ở đâu. Xoá.
  (Cũng không dùng: `components/TrashSection.tsx`, `TrashCardSkeleton` trong
  `LoadingSkeleton.tsx`.)

Ý tưởng sau này (chưa làm): ghi âm giọng người học khi shadowing và cho AI chấm
(so với câu gốc về nhấn âm, nối âm). Đây là tính năng lớn, để sau Phase 2.

---

## Phase 2 - Chia mode và track progress - XONG

**Xong (2026-10-01).** Khác plan ở một điểm: dictation vẫn lưu ở field cũ
`completedSentences` (không chép sang `progress.dictation.completed`). Không cần
chuyển dữ liệu, và bản app cũ vẫn đọc được. `progress` chỉ giữ shadowing và vị trí
từng mode; xem `lib/progress.ts`.

Đã thống nhất:

- 3 tab ngang hàng: **Listen** (đổi tên từ Normal), **Dictation**, **Shadowing**.
  Shadowing không còn là nút bật/tắt trong Normal nữa.
- Chỉ Dictation và Shadowing có %. Listen chỉ nhớ vị trí.
- Một câu Shadowing tính là "xong" khi người học bấm Enter để qua câu tiếp.
- Bài hoàn thành = Dictation 100% và Shadowing 100%.

Dữ liệu mới trên lesson doc:

```ts
progress: {
  dictation: { completed: Record<number, boolean>; lastIndex: number; updatedAt: number };
  shadowing: { completed: Record<number, boolean>; lastIndex: number; updatedAt: number };
  listen:    { lastTime: number; updatedAt: number };
}
lastMode: 'listen' | 'dictation' | 'shadowing';
```

Việc cần làm:
1. Thêm type + hàm đọc/ghi trong `lib/db.ts`. Đọc dữ liệu cũ: nếu chưa có `progress`,
   lấy `completedSentences` làm `progress.dictation.completed`. Không xoá field cũ
   ngay, để còn rollback.
2. Đổi `AppMode` thành `'listen' | 'dictation' | 'shadowing'`. Đưa logic shadowing
   (Enter = câu tiếp, Control = nghe lại) từ toggle sang tab riêng.
3. Lưu `lastIndex` / `lastTime` khi đổi câu (debounce, không ghi Firestore mỗi giây).
4. Khi mở bài: nút "Tiếp tục: Dictation, câu 23/80" -> vào đúng mode, nhảy đúng câu.
5. Sidebar: hiện 2 thanh nhỏ D và S cho mỗi bài.
6. Cập nhật test dictation (`scripts/test-dictation`) cho mode mới.


---

## Phase 3 - UI/UX

Xem bằng app chạy local (E2E mode) ở 1280x800 và 375x812.

- **U1. Màu và emoji.** Đang có emoji 🎧 🎴 (`NewLessonModal.tsx:180`, `TrashCard.tsx:13`,
  `EmptyState.tsx:9`), tiêu đề gradient ở màn Welcome, nút xanh lá / xanh dương.
  Đã chọn: **monochrome hoàn toàn**. Icon SVG một nét `currentColor`, bỏ gradient,
  nút trung tính. Màu chỉ dùng cho trạng thái: đúng/sai trong dictation, câu đang phát.
- **U2. Mobile.** Sidebar mở sẵn và che hết nội dung. Nút mở sidebar đè lên tab mode.
  Sửa: trên mobile sidebar đóng mặc định, mở dạng drawer có lớp nền tối; header
  không bị đè.
- **U3. Header không có tên bài.** Khi đang học, không biết đang mở bài nào. Thêm
  tên bài + progress của mode hiện tại vào header.
- **U4. Transcript quá thưa.** Ở 1280x800 chỉ thấy khoảng 8 câu. Giảm padding mỗi dòng
  để thấy nhiều câu hơn (khoảng 12-14).
- **U5. Thanh điều khiển nhiều nút.** Player có tốc độ, lặp, shadowing, ẩn video,
  ẩn phụ đề, focus, reset. Sau Phase 2: mỗi tab chỉ hiện nút của mode đó; "Reset
  progress" chuyển vào menu "...".
- **U6. Màn Welcome.** Sau khi bỏ Decks, đổi thành danh sách "Tiếp tục học" (các bài
  học gần đây + progress). Ăn khớp với Phase 2.
- **U7. File quá dài (tuỳ chọn).** `app/page.tsx` 1134 dòng, `SidebarFolderTree.tsx`
  967 dòng. Tách nhỏ sau khi xoá Decks, chỉ khi cần cho Phase 2.

---

## Thứ tự làm

1. ~~Phase 0 (xoá Decks)~~ - xong
2. ~~Phase 1: A1, A5 (nhanh, là bug) -> A2 -> A3~~ - xong
3. ~~Phase 2 (mode + progress)~~ - xong
4. Phase 3: U2, U3, U5, U6 làm cùng Phase 2; U1, U4 làm riêng; U7 nếu cần
