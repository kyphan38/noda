# PLAN-bg-music - noda: nhạc nền chill khi học

Viết ngày 2026-11-28. Tham khảo cách mora làm (`mora/src/platform/audio.ts`,
`mora/src/store/trackUpload.ts`, `mora/src/platform/mediaCache.ts`).

## Vì sao

Nhiều clip (video/audio) không có nhạc nền, nghe khô. Owner muốn có nhạc nền
nhẹ để học chill hơn, bật/tắt được, và tự thêm bài nhạc của mình.

## Quyết định của owner (2026-11-28)

| Chỗ | Nhạc nền |
|---|---|
| Listen | Có, hạ nhẹ (ducking) khi clip phát |
| Dictation | Có, hạ nhẹ khi clip phát |
| Shadowing | Có, hạ nhẹ khi clip phát. **Dừng hẳn** khi mở Speaking check (mic) |
| Talk, Speaking | Không |

- Mặc định **tắt**. Ai không bật thì app giữ nguyên như cũ.
- Ducking: hạ nhẹ thôi, để vẫn giữ cảm giác chill.
- File nhạc mặc định: owner gửi sau (phase B0 chờ file).

## Thiết kế

### Âm thanh

- Một kênh nhạc duy nhất, phát lặp (loop). Không copy cả engine mora (350 dòng,
  có ambient + music + idle + chuông): noda chỉ cần một kênh.
- Âm lượng qua **Web Audio GainNode**, không dùng `audio.volume`: Safari trên
  iOS bỏ qua `audio.volume` (luôn 100%).
- Số liệu ban đầu (chỉnh sau khi thử):
  - Âm lượng mặc định: 12%, thanh chỉnh 0-40%.
  - Ducking: khi clip đang phát, nhạc còn 60% âm lượng đã chọn. Chuyển trong 300ms.
  - Fade in 800ms, fade out 450ms (giống mora). Không bao giờ cắt đột ngột.
- Biết clip phát hay dừng: nghe sự kiện `play` / `pause` / `ended` trên
  `mediaRef`. Cả file upload lẫn YouTube đều phát sự kiện này
  (`src/lib/youtubeMediaAdapter.ts` có `dispatchEvent`).
- Nhạc chỉ bắt đầu sau một lần bấm của người dùng (trình duyệt chặn autoplay).
  Lần bấm Play đầu tiên trong bài sẽ mở AudioContext.
- iOS: đặt `navigator.audioSession.type = 'playback'` khi có (Safari 16.4+),
  nếu không Web Audio bị tắt khi gạt nút im lặng.

### Khi nào phát, khi nào dừng

- Phát: đang ở trang bài học, tab Listen / Dictation / Shadowing, đã bật.
- Dừng hẳn (fade out): mở Speaking check, rời trang bài học, tắt option.
- Phát lại (fade in): đóng Speaking check, quay lại bài.
- Đang gõ Dictation hoặc clip đang dừng: nhạc vẫn phát ở âm lượng đầy đủ.

### Lưu cài đặt

- Bật/tắt, bài đang chọn, âm lượng: lưu theo máy trong `localStorage`, giống
  Theme và các toggle khác (`src/lib/theme.ts`, `src/lib/lesson-session.ts`).
- Bài nhạc tự thêm: file ở Storage, danh sách ở Firestore, nên mọi máy đều có.

### Nơi lưu file nhạc

| Loại | Nơi lưu | Ai ghi |
|---|---|---|
| Nhạc mặc định | Storage `defaults/bgm/*` + danh sách `src/data/bgMusic.json` | chỉ owner, bằng script |
| Nhạc tự thêm | Storage `users/{uid}/bgm/{id}.{ext}` + Firestore `users/{uid}/bgm/{id}` | owner trong app |

- Không để trong `public/`: deploy nặng, như mora đã gặp.
- `storage.rules`: thêm `defaults/bgm/**` chỉ đọc khi `allowed()`; thêm
  `users/{uid}/bgm/**` cho owner, `audio/*`, tối đa 50MB.
- Cache trên máy (Cache Storage, giới hạn ~200MB, bỏ bài lâu không dùng trước):
  mỗi bài tải một lần trên mỗi máy, sau đó phát offline.

### Giao diện (minimal UI, gray-only)

- Settings (gear): một dòng "Background music" với `off · on`. Khi on, hiện
  thêm: chọn bài, thanh âm lượng, "add your own".
- Menu "More" của Player: một dòng bật/tắt nhanh, chữ rõ ràng.
- Không giải thích dài trong UI. Lý do để trong comment code.
- Cập nhật trang Guide (`src/app/guide/page.tsx`).

### Code (giữ file nhỏ)

- `src/lib/bgMusic/engine.ts`: AudioContext, GainNode, fade, duck, loop.
- `src/lib/bgMusic/gain.ts`: hàm thuần (âm lượng x hệ số duck, bước fade,
  có nên phát không theo mode + trạng thái). Có unit test.
- `src/lib/bgMusic/prefs.ts`: đọc/ghi localStorage. Có unit test.
- `src/lib/db/bgm.ts`: upload, danh sách, xoá bài tự thêm.
- `src/hooks/useBackgroundMusic.ts`: nối engine với mode, `mediaRef`, Speaking check.
- `src/components/BackgroundMusicSettings.tsx`: dòng trong Settings.
- `LessonView.tsx` đang 650 dòng: theo AGENTS.md, **tách một phần ra trước**
  (ví dụ phần bật/tắt video hoặc phần Speaking check thành hook riêng) rồi mới
  gắn `useBackgroundMusic`.
- Không có AI call mới, nên không cần đụng `upkeep/ai-evals`.

## Phase

| Phase | Nội dung | Chờ gì |
|---|---|---|
| **B1** | Engine + hàm thuần + prefs + unit test. Thử bằng một file mp3 tạm trên máy | - |
| **B2** | Tách LessonView, gắn `useBackgroundMusic`: chỉ 3 tab, ducking, dừng khi Speaking check, dừng khi rời bài | B1 |
| **B3** | UI: dòng Settings + nút trong More của Player + trang Guide | B2 |
| **B0** | Owner gửi file nhạc. Script upload lên `defaults/bgm/`, `bgMusic.json`, deploy storage rules, cache trên máy | file của owner |
| **B4** | "add your own": upload bài, danh sách Firestore, xoá (bấm 2 lần), firestore + storage rules | B3 |

B1-B3 làm được trước khi có file (dùng file tạm để thử). B0 làm khi owner gửi
nhạc. Hỏi owner trước mỗi phase.

## Kiểm tra mỗi phase

- `npm test` (unit + dictation) xanh.
- E2E bằng `npm run dev:e2e` (bỏ qua login): nhạc không phát ở Talk/Speaking,
  dừng khi mở Speaking check, ducking khi clip phát.
- Thử thật trên iPad/iPhone: âm lượng nhỏ đúng, không bị tắt bởi nút im lặng,
  YouTube và nhạc phát cùng lúc được.

## Tiến độ

- 2026-11-28: viết plan.
- **B1 xong (2026-11-28):** `src/lib/bgMusic/` có `gain.ts` (hàm thuần),
  `prefs.ts` (localStorage, store cho useSyncExternalStore), `engine.ts`
  (AudioContext + GainNode, fade, duck, đổi bài có fade, tự pause sau khi
  fade out). 21 unit test mới, cả bộ 481/481 xanh. Thử thật trên trình
  duyệt với file mp3 tạm: fade in 0 → 0.2 trong 800ms, duck còn 0.12, tắt về
  0 rồi element pause, đổi bài fade out rồi fade in, bật lại phát tiếp.
  Chưa thử trên iPhone/iPad (làm ở B2-B3 khi có giao diện).
- **B2 xong (2026-11-28):** LessonView tách còn 508 dòng (AI panel →
  `useShadowingAiPanel`, trạng thái media → `useLessonMediaStatus`).
  `useBackgroundMusic` gắn vào LessonView: duck theo `isPlaying`, dừng khi
  Speaking check mở, fade out khi rời bài. Engine dùng chung cả lượt
  (`sharedBgMusicEngine`): đổi tab Listen/Dictation/Shadowing làm LessonView
  mount lại, engine chung giữ AudioContext nên nhạc không bị dừng.
  `tracks.ts` (`DEFAULT_TRACKS` còn rỗng tới B0, `pickTrackUrl` có test).
  Thử trong app (dev:e2e, file tạm): Play → nhạc 0.12 (duck), Pause → 0.2,
  đổi sang Dictation và Shadowing nhạc vẫn phát, sang Talk nhạc về 0 và
  pause, tắt option thì không tải file nhạc. Speaking check chưa thử được
  trong E2E (cần bài có media trên Storage); quy tắc mic đã có unit test.
- **B3 xong (2026-11-28):** Settings có dòng "Background music" `off · on`
  (`nav/BackgroundMusicSettings.tsx`); khi on hiện chọn bài (khi có từ 2
  bài), thanh âm lượng 0-40, và "No tracks yet" khi danh sách rỗng. Menu
  More của Player có switch "Music" (mọi tab bài học; nhãn ngắn vì menu hẹp),
  bật thì có chấm trên nút More. Trang Guide có mục Background music. Thử
  trong app (dev:e2e, 2 bài tạm): sáng, tối, mobile 375px; chọn Lofi thì
  phát đúng bài; tắt trong More thì nhạc về 0, clip vẫn phát; bật lại phát
  tiếp không cần bấm thêm.
- **B0 xong (2026-11-28):** 17 bài của owner, đổi tên ngắn lowercase, chuẩn
  hoá độ to về -18 LUFS (trước lệch từ -8.5 tới -23), 128k, bỏ metadata. Gốc
  đã xử lý ở `media/bgm/` (git-ignored). 3 nhóm: piano (8), cinematic (4),
  chill (5). Upload bằng `scripts/upload-bgm.sh` lên `defaults/bgm/` (đặt
  CORS và thêm download token). Storage rules: `defaults/bgm` chỉ owner đọc
  được (đã deploy), vì là nhạc có bản quyền nên không mở công khai. Hết bài
  thì tự phát bài kế tiếp trong nhóm. Settings: chọn nhóm rồi chọn bài. Thử
  trong app với file thật (token URL tạm, e2e): có tiếng thật qua Web Audio,
  tự chuyển bài, đổi nhóm. Chưa có cache offline (trình duyệt vẫn cache vì
  file có Cache-Control 1 năm).
- **B4 xong (2026-11-28):** nhóm "mine" trong Settings: "add a track"
  (audio tối đa 30MB, hiện reading / uploading %, cancel), bài mới được chọn
  luôn; "delete" bấm 2 lần (trong 3 giây). Lúc upload app giải mã file một lần
  để đo độ to và lưu gain (mục tiêu -21 dB RMS như bài mặc định, không vượt
  peak 0.95, trong 0.25..4). Tên lấy từ tên file, lowercase. File ở
  `users/{uid}/bgm/`, danh sách ở Firestore `users/{uid}/bgmTracks` (rules đã
  deploy). CORS thêm `localhost:3011` (cổng noda-dev). Thử thật với tài khoản
  owner: upload 1MB, bản ghi gain 1.028, phát trong bài với gain 0.123, xoá
  thì Firestore và Storage đều sạch.
- Lưu ý cho B0: bucket Storage của noda cần CORS cho domain app (như mora),
  nếu không MediaElementSource phát ra im lặng.
