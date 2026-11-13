# PLAN-youtube - noda: tạo lesson từ link YouTube

Viết ngày 2026-11-13. Owner chưa duyệt: hỏi owner trước khi bắt đầu P1.
P0 là bước kiểm tra bắt buộc. Kết quả P0 quyết định P1 làm theo cách nào.

## Prompt để dán cho AI làm

```
Work in /Users/kyphan/ws/app/noda. Read ws/app/AGENTS.md, noda/AGENTS.md
and noda/PLAN-youtube.md first. Implement only phase <P1> from
PLAN-youtube.md, exactly as written. Follow "Quy tắc cho mọi phase" and
"Lỗi hay gặp". Run every command in "Kiểm tra mỗi phase" and fix all
failures you caused. Then update the "Tiến độ" list, commit only the files
you changed on main (no Co-Authored-By), and stop. Do not push. Tell me in
Vietnamese, in short simple sentences, what changed and how to try it.
Do not start the next phase.
```

Đổi `<P1>` thành phase muốn làm. Mỗi lần chỉ một phase.

## Mục tiêu

- Người dùng dán link YouTube vào modal "New lesson".
- App **kiểm tra trước** video có phụ đề tiếng Anh **do kênh tự upload** không
  (không tính phụ đề tự động, "auto-generated"). Kiểm tra chạy **trên trình
  duyệt** (phương án B', owner chọn 2026-11-13 sau P0).
  - **Không có:** hiện thông báo ngắn, không cho tạo lesson từ link đó.
  - **Có:** hiện ô kéo `.srt`. Người dùng lấy file bằng script trên máy.
    App không tự tải nội dung phụ đề (YouTube chặn server, xem P0).
- Lesson phát bằng YouTube nhúng (IFrame Player API). Không tải audio/video.
- Dictation, lặp câu, shadowing và AI shadowing đều chạy như lesson thường.

## Kết quả POC (2026-11-13, video BBC `h-NZcQF7jgI`)

Đã test, không đụng code app. File ở scratchpad, không commit.

- **Player nhúng, 10 câu × 3 lần lặp, 1x:**
  - Dừng cuối câu lệch trung bình 9ms, tối đa 17ms.
    `getCurrentTime()` cập nhật mỗi frame, không cần tự tính bù.
  - Lặp lại một câu mất ~300ms (tối đa ~450ms) mới phát lại.
  - Không mất đầu câu. Sự kiện `PLAYING` đến trễ ~200ms so với tiếng thật.
  - Tab ẩn làm `requestAnimationFrame` chậm lại, số đo sai hẳn.
- **Gemini nhận link YouTube + `videoMetadata.startOffset/endOffset`**
  (`gemini-3.8-flash`, `MEDIA_RESOLUTION_LOW`):
  - Cắt câu 1.4-5s: 8/10 câu khớp từng chữ. 2 câu lệch 1 từ ở mép câu.
  - Prompt shadowing thật: 3/3 qua `normalizeShadowingAnalysis` ngay lần đầu.
  - ~100 token mỗi giây clip. Thời gian: 14s, 36s, 42s (timeout hiện tại 55s).
- **Lấy phụ đề:**
  - `yt-dlp --list-subs` phân biệt được 2 loại: `Available subtitles` (tự upload)
    và `Available automatic captions` (tự động).
  - Endpoint cũ `youtube.com/api/timedtext?v=...` giờ trả về rỗng (cần token ký).
    App **không** thể lấy phụ đề bằng một request đơn giản.
  - Chưa test lấy phụ đề từ IP của Cloud Functions. Đây là rủi ro lớn nhất (xem P0).

## Hiện trạng code (2026-11-13, có thể lệch vài dòng)

- App là static export (`next.config.ts`: `output: 'export'`).
  Không có API route. Mọi việc phía server phải là Cloud Function.
- Tạo lesson: `hooks/useLessonCreateFlow.ts` `createLessonRecord()`.
  Luôn upload media lên Storage, rồi lưu `LessonRecord` (`lib/db.ts:23`).
- Modal: `components/NewLessonModal.tsx` (kéo thả media + .srt).
- Parse phụ đề: `parseTranscript()` trong `lib/utils.ts` (SRT chuẩn).
- Player: `hooks/useMediaPlayer.ts` giữ `mediaRef: HTMLMediaElement`.
  `hooks/useLessonPlaybackLoop.ts` đọc `currentTime` và `seeking` mỗi frame.
  `components/LessonView.tsx` render `<audio>`/`<video>`/`VideoPane` và nghe
  `loadedmetadata`, `play`, `pause`, `ended`, `error`, `waiting`.
- Các thuộc tính media đang dùng: `currentTime` (đọc/ghi), `paused`, `play()`,
  `pause()`, `playbackRate`, `seeking`, `videoWidth`.
- Có media hay không: `useLessonLogic.ts:140` và `:332` dựa vào
  `mediaPath`/`mediaUrl`.
- AI: `functions/src/analyzeShadowingPattern.ts`. Bắt buộc có
  `mediaStoragePath`, tải bản FLAC, cắt WAV bằng ffmpeg, kiểm tra im lặng,
  gửi `inlineData` cho Gemini. Client gọi qua `lib/shadowingAnalysis.ts`.
- Xoá lesson: `functions/src/lib/lessonCleanup.ts` trả `[]` khi không có
  `mediaPath`, nên lesson YouTube xoá được mà không cần sửa.

## Quy tắc cho mọi phase

- Theo `AGENTS.md`: không em dash, code và comment bằng tiếng Anh, chữ trên
  UI càng ít càng tốt, không `Co-Authored-By`.
- Lesson thường (upload file) phải chạy y như cũ. Không đổi dữ liệu cũ.
- Không tải audio/video YouTube ở bất kỳ đâu (client hay server).
- Không dùng phụ đề tự động, kể cả khi đó là track duy nhất.
- Chỉ nhận video ID khớp `^[A-Za-z0-9_-]{11}$`. Server không bao giờ fetch URL
  do client gửi, chỉ dựng URL từ video ID.
- Mọi Cloud Function mới kiểm tra `request.auth.uid` bằng `ALLOWED_USER_UID`
  như `analyzeShadowingPattern`.

## Kiểm tra mỗi phase

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

```bash
cd functions && npm run build
```

Phase có UI: mở app bằng preview `noda-e2e` và thử bằng tay với video POC
`https://youtu.be/h-NZcQF7jgI`. Giữ Browser pane hiện khi đo thời gian.

## P0 - Kiểm tra lấy phụ đề từ Cloud Functions (bắt buộc, làm trước)

Câu hỏi: Cloud Function ở `asia-southeast1` có (1) biết video có phụ đề tự
upload không và (2) tải được nội dung phụ đề đó không?

1. Viết một function test riêng (không export trong `index.ts` chính, hoặc
   xoá sau khi test). Dùng thư viện innertube cho Node (ví dụ `youtubei.js`)
   để đọc `captionTracks` của video.
   - Track tự động có `kind: "asr"`. Track tự upload không có `kind`.
2. Tải nội dung track tự upload (`fmt=json3` hoặc `vtt`).
3. Thử 10 video: 5 có phụ đề tự upload, 3 chỉ có auto, 2 không có phụ đề.
   Gọi mỗi video 3 lần, cách nhau vài phút.
4. Ghi lại: tỉ lệ thành công, lỗi gặp phải (nhất là "Sign in to confirm
   you're not a bot", HTTP 429, nội dung rỗng).

### Kết quả P0 (2026-11-13) - XONG

Probe: `youtubei.js` 18.3.0, 10 video (5 có phụ đề tự upload, 3 chỉ có auto,
2 không có phụ đề), 5 client (WEB, MWEB, ANDROID, IOS, TV).

- **Trên máy Mac (IP nhà):** client `IOS` đúng 10/10. Track auto có
  `kind: "asr"`. Tải `fmt=json3` được, không cần token. `ANDROID` liệt kê track
  đúng nhưng `fmt=json3` không có tác dụng. WEB/MWEB/TV bị chặn.
- **Trên Cloud Functions `asia-southeast1`:** bị chặn **100%**. 70/70 request
  (vòng 1: IOS + ANDROID; vòng 2: cả 5 client) đều trả `LOGIN_REQUIRED`
  "Sign in to confirm you're not a bot". Bị chặn ngay ở bước đọc danh sách
  track, nên gate cũng không làm được trên server. Bỏ vòng 3 vì 2 vòng đều
  chặn hết.
- Function test `p0-yt-probe` đã xoá. Code probe ở scratchpad, không commit.
- **Phát hiện thêm - gate chạy trên trình duyệt được:** player nhúng có
  `player.getOption('captions', 'tracklist')` (sau `player.loadModule('captions')`).
  Danh sách này **chỉ có track tự upload**, không có track auto.
  - Đúng 8/8 video so với `yt-dlp --list-subs`.
  - Có track: trả về sau ~300ms. Không có: phải chờ hết thời gian (đã dùng 6s).
  - Đây là API không có trong tài liệu chính thức, có thể đổi bất cứ lúc nào.
  - Chỉ cho biết **có hay không**. Không đọc được nội dung phụ đề (nằm trong
    iframe khác domain).

**Kết luận:** rơi vào trường hợp **C** bên dưới (server bị chặn hoàn toàn).
Gợi ý: làm **B'** - gate trên trình duyệt bằng `tracklist`, không cần server
hay API key. Nội dung phụ đề: người dùng kéo `.srt` từ script trên máy.
"Apply luôn" (tự lấy nội dung) **không làm được** nếu không có máy chủ dùng
IP nhà. **Owner chọn B' (2026-11-13).** P1/P2 bên dưới đã viết theo B'.

**Quyết định sau P0 (hỏi owner):**

- **A - Chạy ổn (≥ 9/10 đúng, không bị chặn):** làm P1 như viết bên dưới.
- **B - Đọc được danh sách track nhưng không tải được nội dung:**
  - Gate vẫn tự động: function trả "có/không có phụ đề tự upload".
  - Khi "có": hiện ô kéo thả `.srt` (người dùng lấy bằng script trên máy).
    Không còn "apply luôn".
- **C - Bị chặn hoàn toàn:** dùng YouTube Data API `captions.list`
  (có `trackKind: standard | asr`, 50 quota mỗi lần gọi) chỉ để làm gate, rồi
  làm như B. Cần owner bật YouTube Data API và cấp API key riêng. Không dùng
  lại Gemini key khi chưa được owner đồng ý.
- **B' - Gate trên trình duyệt (thêm sau P0, gợi ý):** như B, nhưng gate dùng
  `tracklist` của player nhúng ngay trong modal. Không cần Cloud Function,
  không cần API key. Rủi ro: API không chính thức. Nếu nó hỏng thì chuyển
  sang C.

## P1 - Link YouTube và gate trong modal (chạy trên trình duyệt)

Không có Cloud Function mới. Mọi thứ chạy trong `NewLessonModal`.

1. File mới `lib/youtube.ts` (hàm thuần, có unit test):
   - `parseYoutubeVideoId(input)`: nhận `youtu.be/ID`, `youtube.com/watch?v=ID`,
     `youtube.com/shorts/ID`, `youtube.com/embed/ID`, `m.youtube.com/...`,
     có thêm `?si=`, `&t=`, `&list=`. Trả `null` nếu sai dạng hoặc ID không
     khớp `^[A-Za-z0-9_-]{11}$`.
   - `pickUploadedEnglishTrack(tracklist)`: chỉ lấy `languageCode` bắt đầu bằng
     `en` và `kind` rỗng (bỏ `asr` cho chắc dù tracklist hiện không có).
     Ưu tiên `en`, `en-US`, `en-GB`, rồi `en-*` đầu tiên.
   - `checkSrtFitsVideo(sentences, durationSec)`: lỗi nếu 0 câu, hoặc câu cuối
     kết thúc sau `durationSec + 2`. Mục đích: bắt trường hợp kéo nhầm `.srt`
     của video khác.
2. File mới `lib/youtubeIframeApi.ts`: tải `https://www.youtube.com/iframe_api`
   **một lần**, trả Promise của `window.YT`. P3 dùng lại file này.
3. Hook mới `hooks/useYoutubeSubtitleGate.ts`:
   - Input: video ID. Tạo player ẩn kích thước nhỏ trong modal (vẫn phải
     render, ví dụ 200×200 ngoài màn hình hoặc mờ đi).
   - `mute()`, `loadVideoById(id)`, rồi cứ 300ms gọi
     `loadModule('captions')` + `getOption('captions', 'tracklist')`.
   - Có track hợp lệ → `ok` (kèm `title` từ `getVideoData().title`,
     `durationSec` từ `getDuration()`, `trackLang`). Dừng video ngay.
   - Hết 6s mà không có → `no-uploaded-subs`.
   - `onError` 100 → `not-found`; 101/150 → `not-embeddable`; 2 → `invalid`.
   - Video đang live (`getVideoData().isLive`) → `live`.
   - Đổi link hoặc đóng modal: huỷ kiểm tra, `destroy()` player.
4. `NewLessonModal.tsx`:
   - Ô "YouTube link" phía trên vùng kéo thả. Dán link (debounce ~400ms) thì
     chạy gate. Có link thì ẩn vùng kéo thả **media** (mỗi lesson một nguồn).
   - Trạng thái gate:
     - Đang kiểm tra: spinner nhỏ, nút Create tắt.
     - `ok`: tên video và ô kéo `.srt`. Tên lesson mặc định = tên video.
     - Lỗi: một dòng, nút Create tắt. Ví dụ `no-uploaded-subs`:
       "No uploaded English subtitles for this video."
   - Kéo `.srt` vào: parse bằng `parseTranscript`, chạy `checkSrtFitsVideo`.
     Lỗi thì hiện một dòng, giữ nút Create tắt.
   - Create chỉ bật khi gate `ok` **và** `.srt` hợp lệ.
   - Kéo nhiều file (batch) chỉ áp dụng cho lesson upload, không đổi.
5. Unit test cho `lib/youtube.ts`. Gate (`useYoutubeSubtitleGate`) thử bằng tay
   trên preview với 3 loại video trong "Video để test".

### Video để test (đã kiểm tra 2026-11-13)

| Loại | Video ID |
|---|---|
| Có phụ đề tự upload | `h-NZcQF7jgI` (en-GB), `iG9CE55wbtY` (en), `P6FORpg0KVo` (en) |
| Chỉ có auto | `RVzIGNFyvYU`, `nh36jE2M064`, `MMcKEo_uq9Q` |
| Không có phụ đề | `Dy3VtjcHdCs`, `HSwGH710EgA` |

## P2 - Lưu và mở lesson YouTube

1. `LessonRecord` (`lib/db.ts`) thêm:
   - `source?: 'upload' | 'youtube'` (không có = `upload`).
   - `youtubeVideoId?: string | null`.
   - Lesson YouTube: `mediaType: 'video'`, `mediaPath: null`, `mediaUrl: null`.
   - Kiểm tra hàm map Firestore (`lib/db.ts` khoảng dòng 160) giữ 2 field mới.
2. `useLessonLogic.ts`: `hasMedia` đúng khi có `youtubeVideoId`.
   Không gọi `getDownloadURL` cho lesson YouTube.
3. `useLessonCreateFlow.ts`: hàm mới `createYoutubeLessonRecord()`.
   Không upload. Lưu `transcriptText` = nội dung `.srt`, `totalSentences` từ
   `parseTranscript`. Tên trùng thì dùng `uniquifyName` như cũ.
4. Sidebar/LessonCard: icon nhỏ cho lesson YouTube nếu `lucide-react` có icon
   phù hợp. Không thêm chữ.
5. Trước P3: mở lesson YouTube hiện transcript, chưa phát được. Hiện một dòng
   "Playback not ready" thay vì lỗi media.

## P3 - Player YouTube

Mục tiêu: **không sửa** `useLessonPlaybackLoop.ts` nếu có thể.

1. File mới `lib/youtubeMediaAdapter.ts`: một object giả `HTMLMediaElement`,
   bọc `YT.Player`, chỉ làm phần app đang dùng:
   - `currentTime` get → `getCurrentTime()`, set → `seekTo(t, true)`.
   - `paused`, `play()` (trả Promise), `pause()`, `playbackRate`.
   - `seeking`: `true` từ lúc set `currentTime` đến khi state = PLAYING/PAUSED
     và thời gian đã gần mục tiêu.
   - `duration`, `videoWidth` (cố định, ví dụ 16:9).
   - `addEventListener`/`removeEventListener` cho `play`, `pause`, `ended`,
     `waiting` (state BUFFERING), `loadedmetadata` (onReady), `error`.
2. Component mới `components/YouTubeStage.tsx`: dùng `lib/youtubeIframeApi.ts` (từ P1),
   tạo player, gán adapter vào `mediaRef`.
   - `playerVars`: `playsinline: 1`, `rel: 0`, `cc_load_policy: 0`,
     `disablekb: 1` (app có phím tắt riêng), `iv_load_policy: 3`.
   - Tắt phụ đề của YouTube để không lộ đáp án dictation
     (`player.unloadModule('captions')` sau onReady).
3. `LessonView.tsx`: lesson YouTube thì render `YouTubeStage` thay cho
   `<video>`/`VideoPane`, cả desktop và mobile.
   - Video luôn hiện, ít nhất 200×200 (điều khoản YouTube). Chế độ ẩn video
     (`videoHidden`) không áp dụng cho lesson YouTube.
4. Tốc độ: YouTube chỉ nhận các mức trong `getAvailablePlaybackRates()`.
   Làm tròn về mức gần nhất. Không đổi UI chọn tốc độ.
5. Thử bằng tay: lặp câu (`repeatCount`), dictation Enter/Control replay,
   tua bằng seek bar, đổi tốc độ, phím tắt, đổi lesson qua lại giữa lesson
   thường và lesson YouTube.

## P4 - AI shadowing cho lesson YouTube

1. `analyzeShadowingPattern.ts`: request nhận **một trong hai**
   `mediaStoragePath` hoặc `youtubeVideoId` (kiểm tra regex ID).
2. Nhánh YouTube:
   - Không ffmpeg, không tải file.
   - Gửi `fileData: { fileUri: "https://www.youtube.com/watch?v=" + id }` và
     `videoMetadata: { startOffset, endOffset }` (giây, 2 chữ số thập phân).
   - `mediaResolution: MEDIA_RESOLUTION_LOW` trong config.
   - Không có kiểm tra im lặng. Thay bằng: câu ngắn hơn `MIN_CLIP_SECONDS`
     thì trả `failed-precondition` như cũ.
   - Prompt, schema, retry, cache giữ nguyên. Không đổi `ANALYSIS_VERSION`.
3. `lib/shadowingAnalysis.ts` và các nơi gọi: gửi `youtubeVideoId` cho
   lesson YouTube. Prefetch và auto-analyze chạy như cũ.
4. Đo thời gian 10 câu trên production. Nếu > 45s thường xuyên thì báo owner
   trước khi tăng timeout.

## P5 - Trường hợp lỗi và hoàn thiện

- Video bị xoá/riêng tư/tắt nhúng **sau khi** tạo lesson: player báo lỗi
  100/101/150 → hiện một dòng lỗi trong lesson, transcript và tiến độ vẫn xem
  được. Không tự xoá lesson.
- Mất mạng: lesson YouTube không phát được. Hiện lỗi, không treo vòng lặp.
- Tab ẩn: vòng lặp `requestAnimationFrame` dừng. Khi tab hiện lại, đồng bộ
  lại thời gian từ player.
- Mobile (iOS Safari, PWA): lần phát đầu cần chạm tay. Khoá màn hình thì
  YouTube dừng: chấp nhận, không tìm cách vượt qua.
- Quảng cáo: không chặn. Nếu quảng cáo chạy, adapter báo `waiting` để vòng
  lặp không xử lý thời gian sai.
- Cập nhật `README.md` (phần tính năng).

## Lỗi hay gặp (đọc kỹ)

- Đo thời gian khi Browser pane bị ẩn cho số sai (~600ms thay vì ~9ms).
- `getPlayerState()` báo PLAYING trễ ~200ms. Đừng dùng nó để đo độ trễ tua.
  Dùng thời gian bắt đầu tăng.
- `seekTo(t, false)` chỉ tua trong phần đã tải. Luôn dùng `true`.
- Gọi API player trước `onReady` sẽ lỗi im lặng.
- Phụ đề YouTube hay có dấu gạch ngang dài (`–`, en dash) trong text. Đó là
  dữ liệu thật, giữ nguyên. Quy tắc "không em dash" chỉ áp dụng cho chữ mình
  viết.
- Lesson cũ không có `source`: luôn coi là `upload`.
- Dev preview chạy code cũ sau khi sửa: service worker (`noda-v1`) giữ chunk
  cũ. Gỡ nó trong tab preview (`navigator.serviceWorker.getRegistrations()`,
  `caches.delete('noda-v1')`) rồi tải lại.
- Đừng chạy `npm run build` khi dev server đang chạy: nó ghi đè `.next` và
  dev server trả 404. Dừng server, build, rồi chạy lại server.
- `page.tsx` đặt `key` cho LessonView theo mode, nên **mỗi lần đổi mode là một
  player YouTube mới** (~0.3-1s mới sẵn sàng). Vì vậy adapter được tạo ngay khi
  mount và giữ lại seek/play/tốc độ cho đến `attach`. Đừng tạo adapter trong
  `onReady`: lệnh resume sau khi đổi mode sẽ bị mất.
- Thanh player trong LessonView từng chỉ hiện khi có `mediaURL`. Lesson YouTube
  không có `mediaURL`: kiểm tra mọi chỗ `mediaURL &&` khi thêm UI mới.
- YouTube nhận tốc độ bất kỳ (0.7, 0.9…), nhưng áp dụng sau ~300ms. Adapter
  trả tốc độ vừa đặt trong lúc chờ.
- `getOption('captions', 'track')` vẫn trả track sau `unloadModule('captions')`,
  nhưng phụ đề không hiện trong video (đã xem bằng mắt khi phát).
- Công cụ click của Browser pane không click được vào iframe YouTube khi đang
  giả lập kích thước màn hình. Bỏ giả lập rồi click.
- Ở `dev:e2e` không có đăng nhập, nên Create báo lỗi lưu. Muốn mở thử lesson
  YouTube thì dùng `localStorage.__e2e_lesson__` với `youtubeVideoId`.

## Không làm (ghi lại để AI sau khỏi đề xuất lại)

- Lấy phụ đề hoặc danh sách track trên Cloud Functions (bị chặn 100%, xem
  P0). Không thêm proxy hay cookies để vượt qua.
- Tải audio/video YouTube trên server bằng yt-dlp (bị chặn IP, vùng xám
  điều khoản; đã từng gỡ xử lý server kiểu này ngày 2026-10-10).
- Dùng phụ đề tự động, hoặc tự gộp phụ đề tự động thành câu.
- Cho chọn track phụ đề, dịch phụ đề.
- Ẩn hẳn video YouTube để chỉ nghe tiếng.
- Đổi model Gemini (giữ `gemini-3.8-flash`).

## Tiến độ

- [x] P0 - Kiểm tra lấy phụ đề từ Cloud Functions (bị chặn, xem kết quả P0)
- [x] P1 - Link YouTube và gate trong modal (chỉ hiện ở dev, cờ `YOUTUBE_LESSONS_ENABLED`; nút Create bật ở P2 khi truyền `onSubmitYoutube`)
- [x] P2 - Lưu và mở lesson YouTube (vẫn chỉ ở dev; lưu thật vào Firestore mới test bằng unit test, chưa test với tài khoản thật)
- [x] P3 - Player YouTube (vẫn chỉ ở dev; chưa test đổi qua lại giữa lesson upload và lesson YouTube vì `dev:e2e` chỉ seed được một lesson)
- [x] P4 - AI shadowing cho lesson YouTube (code xong; **chưa deploy function**, nên chưa đo 10 câu trên production. Chạy thử code đã build với Gemini trên máy: 4/4 câu OK, 0.86-8.2s, 14-41s)
- [ ] P5 - Trường hợp lỗi và hoàn thiện
