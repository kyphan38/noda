# Plan: sửa các lỗi còn lại sau review

Viết ngày 2026-10-01, dựa trên 3 báo cáo review (commit `13b9ba3`) và kiểm tra lại
trên main `5474d14`. Số # là số trong bảng tổng hợp. Bỏ qua #3 (security rules)
theo yêu cầu.

Cách làm: mỗi đợt một branch, mỗi mục một commit. Cuối mỗi đợt: chạy tsc, unit test,
build không có `functions/node_modules` (giống Vercel), các section E2E liên quan,
rồi hỏi trước khi merge và push.

Các quyết định đã chốt ngày 2026-10-01 (ghi "Đã chọn"). Quyết định mới phát sinh thì hỏi trước.

---

## Đợt 1 - Tránh mất dữ liệu (việc nhỏ)

### F1. Đổi bài: progress bài cũ ghi đè bài mới; transcript cũ hiện dưới tên mới (#1, #2)

Nguyên nhân (`hooks/useLessonLogic.ts`, `handleLoadLesson`):
- `currentLessonId` đổi sang bài mới *trước* khi chờ `resolveLessonMediaUrl`.
- Trong lúc chờ, state vẫn là progress của bài cũ, và các effect lưu (200ms / 1s)
  ghi state đó vào doc của bài mới.
- Thêm một lỗi cùng chỗ: khi đổi bài, cleanup của effect huỷ timer đang chờ, nên
  những gì gõ trong 200ms cuối ở bài cũ bị mất.

Cách sửa:
1. Đầu `handleLoadLesson`: lưu ngay (flush) các thay đổi đang chờ của bài cũ, rồi
   `setIsStarted(false)` để các effect lưu ngừng hoạt động.
2. Đọc doc + lấy URL xong mới đặt `currentLessonId`, transcript, progress và
   `isStarted` cùng một lúc.
3. Thêm cờ `isLessonLoading`. `LessonView` hiện skeleton thay vì transcript cũ.
4. Kiểm tra: thêm `@testing-library/react` + `jsdom` (dev dependency) để test hook
   với `lib/db` giả: đổi bài khi URL chậm thì không có lần ghi nào vào doc sai, và
   thay đổi chưa lưu của bài cũ vẫn được ghi.

### F2. Reset progress không hỏi lại (#4)

Đã chọn: toast "Progress reset" có nút **Undo**
trong 6 giây (`Toast` thêm action). Undo trả lại bản chụp trước khi reset.

### F3. Popup "Lesson complete" ghi sai và xoá vĩnh viễn (#5)

Đã chọn: popup chỉ chúc mừng, có 2 nút **Keep** và **Move to trash**.
Bỏ ô gõ "Delete" (vì vào Thùng rác thì khôi phục được). Sửa câu chữ, không còn nhắc
"device / browser".

### F4. Thanh tốc độ cho kéo về 0.0× (#9)

`components/Player.tsx:125` đổi `min` thành 0.5, và `changeSpeed` trong
`hooks/useMediaPlayer.ts` cũng chặn ở 0.5. Kiểm tra lại section E2E 14 (popover
tốc độ).

### F5. 2 unit test SRT fail (#16)

Xác nhận `parseTranscript` cố ý cắt bớt các câu bị chồng thời gian (`lib/utils.ts`),
rồi sửa 15f/15i theo hành vi đó. Nếu thấy code mới là sai thì báo lại, không tự sửa
code.

---

## Đợt 2 - Chi phí và trải nghiệm

### F6. Xoá bài không xoá file trên Storage và `shadowingAnalysis` (#7)

Đã chọn: Cloud Function `onLessonDeleted` (trigger khi doc
`users/{uid}/lessons/{id}` bị xoá). Function xoá file media (`mediaPath`), file FLAC
trong `analysis-audio/`, và subcollection `shadowingAnalysis`. Phải làm ở server
vì client không có quyền xoá `analysis-audio/`, và trigger này bắt được mọi đường
xoá (nút Delete, Remove all trong Trash, popup).

Rác cũ đã có sẵn trên Storage: viết script chạy thử (dry-run) để liệt kê, rồi **hỏi
trước** khi xoá thật.

### F7. Thông báo lỗi sai hoặc thiếu (#10)

- Bỏ 2 câu "IndexedDB may be unavailable" trong `app/page.tsx`.
- Tải bài lỗi: hiện toast, và quay về trạng thái trước (không để header sai tên).
- Tạo bài lỗi: modal **không đóng**, giữ nguyên tên, file, thư mục; hiện lỗi trong
  modal. Chỉ đóng khi tạo thành công.

### F8. Upload không có thanh % (#11)

`uploadLessonMediaToFirebase` dùng `uploadBytesResumable`, báo % qua callback.
`NewLessonModal` hiện thanh tiến trình và số %.

---

## Đợt 3 - Hiệu năng (việc lớn hơn)

### F9. Trang render lại 60 lần/giây khi đang phát (#12)

- Thời gian phát mỗi frame chỉ nằm trong ref + một store nhỏ
  (`useSyncExternalStore`). Chỉ thanh seek của `Player` đọc store này.
- `page.tsx` chỉ giữ `activeIndex` (đổi khi sang câu mới) và thời gian đã giới hạn
  khoảng 4 lần/giây (cho resume saver và hiển thị giờ).
- `Transcript` nhận `activeIndex` thay vì `currentTime`.
- Đo trước và sau bằng React Profiler trên bài 425 câu. Chạy lại E2E 6, 7, 8, 13
  (đồng bộ audio).

### F10. Cloud Function có thể OOM với video lớn ở lần phân tích đầu (#8)

Thay vì tải cả file gốc vào `/tmp` (nằm trong RAM), cho ffmpeg đọc thẳng từ signed
URL và chỉ ghi ra file FLAC nhỏ. RAM dùng gần như không phụ thuộc vào cỡ video. Thử
ở máy với một file lớn qua HTTP server local, rồi deploy function.

### F11. Sidebar tải toàn bộ nội dung mọi bài (#13)

Số liệu thật: 12 bài = 286 KB mỗi lần mở app. 96% là transcript + progress mà sidebar
không dùng. Mỗi lần lưu progress (200ms khi gõ), listener lại nhận cả doc (~30 KB).

Đã chọn: doc bài học chỉ giữ metadata + số câu đã xong (đếm sẵn).
Transcript, `dictationInputs` và các map progress chuyển sang subdoc
`lessons/{id}/content/main`, chỉ đọc khi mở bài. Cần:
1. Export backup toàn bộ lessons ra file JSON trước.
2. Script migrate có dry-run; app đọc được cả dạng cũ lẫn mới trong lúc chuyển.
3. Chạy thật sau khi chủ app đồng ý.

---

## Thứ tự

1. Đợt 1: F1 → F5 → F4 → F3 → F2
2. Đợt 2: F7 → F8 → F6
3. Đợt 3: F9 → F10 → F11
