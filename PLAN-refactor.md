# PLAN-refactor (noda)

Trạng thái (2026-11-16, branch `refactor/src-layout`): Phase 1 và 3 xong; Phase 2 làm một phần. Unit 271/271, dictation E2E 230/230 sau mỗi bước, build OK.
- Phase 0: chưa làm. Cần owner quyết định có bỏ `example/*.mp4` khỏi git không.
- Phase 1: code đã ở `src/`; `@/*`, vitest và script test-dictation trỏ vào `src/`.
- Phase 2: đã tách `useAuthGate`, `useDictationHandlers`, `useLessonTrash`, `useShadowingControls`, `useResumePrompt` (page.tsx 1189 -> 958). Còn lại `useItemUrlSync` + `useLessonSelection`: phần chọn bài và đồng bộ URL nằm rải rác giữa nhiều effect, tách ra sẽ đổi thứ tự effect. Chỉ làm khi sắp sửa phần đó, và chạy lại toàn bộ E2E.
- Phase 3: `lib/db/` (types, shared, media, lessons, shadowing, folders, local); `index.ts` giữ đúng các export cũ.
- Phase 4, 5: chưa làm.
- Chạy E2E trong worktree: dev server `PORT=3110 NEXT_PUBLIC_E2E_MODE=true npx next dev`, rồi `E2E_PORT=3110 npx tsx scripts/test-dictation/run-all.ts`.

Mục tiêu:
1. Đưa code vào `src/`, dọn thư mục gốc.
2. Tách `app/page.tsx` (1189 dòng) thành các hook nhỏ.
3. Tách `lib/db.ts` (775 dòng) theo từng loại dữ liệu.
4. Tách 2 component to: `SidebarFolderTree.tsx` (907) và `NewLessonModal.tsx` (681).

Không đổi tính năng. Không đổi giao diện.

## Nguyên tắc chung

- Mỗi phase là một commit. Hỏi owner trước khi bắt đầu phase mới.
- Trước và sau mỗi phase: `npm run test:unit`, `npm run test:dictation`, E2E (dùng `npm run dev:e2e`, không cần login). Số test pass phải giống nhau (memory: E2E 230/230).
- Chỉ di chuyển và gom code. Không đổi logic, text UI, `data-testid`.
- File mới nên dưới khoảng 400 dòng.

## Hiện trạng

- Không có `src/`. Thư mục gốc lẫn code (`app`, `components`, `hooks`, `lib`, `types`, `constants`) với file khác: `converted_script.py`, `metadata.json`, `__pycache__`, `firestore-debug.log`, `audio/`, `example/` (có file `.mp4` đang được git theo dõi).
- `app/page.tsx` đã dùng nhiều hook (`useMediaPlayer`, `useLessonLogic`, `useFolders`, ...), nhưng vẫn còn tự làm: auth, đồng bộ URL, chọn bài, thùng rác, xử lý dictation (khoảng 200 dòng), shadowing, nút resume.
- `lib/db.ts` gộp: đường dẫn Firestore, upload media, lesson, folder, shadowing, speaking, progress, và phần IndexedDB cũ.
- `vitest.config.ts` chỉ chạy test trong `scripts/test-dictation/__tests__`. Các file `lib/` khác không có unit test.

## Phase 0: dọn thư mục gốc

1. Kiểm tra từng file trước khi xoá hoặc bỏ khỏi git:
   - `converted_script.py`, `metadata.json`: tìm xem có code hay script nào dùng không (`grep -r`). Không dùng thì `git rm --cached` và thêm vào `.gitignore`, hoặc chuyển vào `scripts/`.
   - `example/*.mp4`, `audio/*`: xem test dictation có dùng không. Nếu dùng thì chuyển vào `scripts/fixtures/`. Nếu không thì bỏ khỏi git.
   - `__pycache__/`, `firestore-debug.log`, `test-results/`: thêm vào `.gitignore`.
2. Hỏi owner trước khi bỏ file `.mp4` khỏi git (file to, có thể owner muốn giữ).

Xong khi: thư mục gốc chỉ còn config, `src/`, `functions/`, `public/`, `scripts/`, các file `.md`.

## Phase 1: chuyển code vào `src/`

1. `git mv app components hooks lib types constants src/`.
2. Sửa `tsconfig.json`: `"@/*": ["./src/*"]`.
3. Sửa `vitest.config.ts` alias `@` thành `./src`.
4. Kiểm tra `components.json` (shadcn), `eslint.config.mjs`, `next.config.ts`, script trong `scripts/` có đường dẫn cứng không.
5. Chạy `npm run build` + toàn bộ test.

Commit này chỉ có di chuyển file, để `git log --follow` vẫn chạy đúng.

## Phase 2: tách `page.tsx`

Tạo các hook mới trong `src/hooks/`:

| Hook mới | Lấy từ page.tsx |
|---|---|
| `useAuthGate` | `authState`, `onAuthStateChanged`, kiểm tra allowlist, `handleLogout` |
| `useItemUrlSync` | `pushItemHistoryState`, đọc URL lúc mở (`urlHydratedRef`), `popstate` |
| `useLessonSelection` | `selectedItem`, `applySelectionFromRow`, `handleItemSelect` |
| `useLessonTrash` | `handleTrashItem`, `handleRestoreItem`, `handleDeleteForeverMany`, toast hoàn tác |
| `useDictationHandlers` | `handleSentenceClick`, `handleDictationChange`, `handleDictationKeyDown`, `handleDictationRetry` |
| `useShadowingControls` | `cycleRepeatCount`, `handleShadowingNext`, `handleShadowingNextTap` |
| `useResumePrompt` | `resumeTarget`, `dismissResume`, `handleResume` |

Phần logic thuần trong dictation (so chữ, chuyển câu) chuyển sang `src/lib/dictation.ts` và thêm unit test.

Thứ tự: `useAuthGate` (dễ nhất), `useLessonTrash`, `useResumePrompt`, `useItemUrlSync` + `useLessonSelection`, `useDictationHandlers`, `useShadowingControls`. Mỗi hook một commit nhỏ.

Mục tiêu: `page.tsx` dưới 350 dòng, chủ yếu là gọi hook và vẽ layout.

## Phase 3: tách `lib/db.ts`

```
src/lib/db/
  paths.ts       # getUser...CollectionPath, getShadowingAnalysisDocPath
  media.ts       # uploadLessonMediaToFirebase, resolveLessonMediaUrl
  lessons.ts     # save/get/subscribe/trash/restore/rename/progress/resume
  folders.ts     # subscribe/create/rename/move/delete folder, patch placement
  shadowing.ts   # shadowing analysis, speaking attempts, shadowing progress
  local.ts       # initDB, saveLesson, getAllLessons ... (IndexedDB cũ), readAllForExport
  index.ts       # export lại tất cả, để import cũ '@/lib/db' vẫn chạy
```

Sau đó, nếu phần `local.ts` (IndexedDB) không còn ai dùng ngoài export, ghi chú lại để owner quyết định có xoá không. Không tự xoá.

## Phase 4: tách component to

1. `SidebarFolderTree.tsx` (907): chuyển logic cây (dựng cây, quy tắc kéo thả, kiểm tra di chuyển hợp lệ) sang `src/lib/folder-tree.ts` + unit test. Component chỉ còn vẽ và bắt sự kiện.
2. `NewLessonModal.tsx` (681): tách theo nguồn: `NewLessonFromFile.tsx`, `NewLessonFromYoutube.tsx`. Modal chính chỉ chọn tab và nút.
3. `LessonView.tsx` (647): chỉ tách nếu thấy rõ phần độc lập (ví dụ thanh điều khiển). Không bắt buộc.

## Phase 5: mở rộng unit test

1. Sửa `vitest.config.ts` `include` để chạy cả `src/**/*.test.ts`.
2. Thêm test cho các file `lib/` thuần đang chưa có: `progress.ts`, `repeat-count.ts`, `item-url.ts`, `transcript-scroll.ts`, `speakingSegments.ts`, `folder-tree.ts`, `dictation.ts`.

## Rủi ro

- Phase 1 đổi đường dẫn: script trong `scripts/` hoặc `functions/` có thể import từ `../lib`. Tìm hết trước khi chuyển.
- Thứ tự hook trong `page.tsx` quan trọng (ví dụ `useLayoutEffect` khi đổi mode, ref `transcriptRef`). Khi tách, giữ đúng thứ tự gọi.
- Playback loop và phím tắt dùng ref. Truyền ref vào hook mới, đừng đổi sang state.
