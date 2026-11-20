# Plan: Talk - học cụm từ rồi nói chuyện với AI

Viết ngày 2026-11-20. Làm theo thứ tự các phase. Mỗi phase là một (hoặc vài)
commit riêng và dùng được ngay. Quyết định mới phát sinh thì hỏi trước.

---

## Mục tiêu

Một chế độ mới trong noda: chọn topic → học 10 cụm từ đến khi thuộc → nói
chuyện với một nhân vật AI, cố dùng các cụm đó → AI review từng lượt → ghi chú
cuối buổi.

- Người dùng: một người (mình), trình độ khoảng B2, hay "nói bừa".
- Thời gian: 15-30 phút/ngày. Có chế độ ngắn cho ngày bận (V2).
- Ngân sách AI: 100-200k VND/tháng. Ước tính: 75-115k VND/tháng năm 2026,
  150-230k từ 2027 khi giá Flash tăng (xem phần Chi phí).
- Mục tiêu học: nói đúng hơn, tự nhiên hơn, và **tự bật ra** được cụm đã học.

## Quyết định đã chốt

- **Theo lượt (turn-based), không dùng voice realtime.** Realtime đắt gấp nhiều lần.
- **Mỗi lượt nói chỉ 1 lần gọi Gemini**: gửi audio, nhận transcript + câu AI hỏi
  tiếp + review. Dùng `gemini-3.8-flash` như các function khác.
- **Phần không cần AI thì không dùng AI**: Matching, điền chỗ trống, "Say it
  again", Chốt hạ 60s đều chấm bằng word diff (dùng lại `checkParagraph` trong
  `src/lib/paragraph-dictation.ts`).
- **Speech-to-text cho phần nói lại**: Web Speech API của trình duyệt (miễn
  phí, chạy tốt trên Edge/Chrome). Trình duyệt không hỗ trợ thì không chấm, chỉ
  cho nghe lại.
- **Giọng AI (TTS)**: Google Cloud TTS **Chirp 3: HD** (giống người thật,
  $30/1M ký tự nhưng miễn phí 1M ký tự đầu mỗi tháng; Talk dùng khoảng
  200-300k ký tự/tháng nên gần như 0đ). Gọi qua một Cloud Function, cache mp3
  theo câu trong Storage. Dự phòng khi lỗi: `speechSynthesis` của trình duyệt
  (giọng "Natural" của Edge). Gemini TTS (chỉnh được giọng điệu) để Backlog.
- **Transcript phải đúng từng chữ, giữ nguyên lỗi.** Không được "sửa đẹp".
  Nếu không thì review vô dụng. Đây là rủi ro lớn nhất, test với giọng thật trước.
- Không lưu file ghi âm ở V1 (giống `assessSpeaking`). Ngoại lệ ở V2: Time Capsule.
- Ghi chú: memory "No server transcription" là về tạo .srt cho lesson. Talk chỉ
  gửi đoạn ghi âm ngắn của mình, giống `assessSpeaking`, nên không vi phạm.

---

## Flow một buổi (~25 phút)

1. **Chọn topic + level** (B1 / B2 / C1, mặc định B2). Hoặc gõ custom topic.
2. **Learn (5-8 phút)**: thẻ cụm từ → Matching → điền chỗ trống → nhìn tiếng
   Việt nói ra cụm. Cụm nào sai thì quay lại cuối hàng. Hết lỗi = xong set.
3. **Talk (10-12 phút)**: 8 lượt. Checklist các cụm của set bên cạnh.
   - **Instant Review** (mặc định khi mới dùng): review sau mỗi lượt.
   - **Flow Mode**: nói liền 8 lượt, review ở cuối.
   - 1 **curveball** mỗi buổi (lượt 3-5), có icon ⚡. Tắt ở B1.
4. **Notes (3 phút)**: cụm đã dùng, cơ hội bỏ lỡ, swap list, lỗi lặp lại.
5. **Chốt hạ 60s**: 3 câu lủng củng nhất, nhìn tiếng Việt nói lại bản Natural.

### Card review của một lượt

1. **Self-Repair** (bật/tắt): transcript có gạch vàng chỗ sai. Bạn tự nói lại.
   Bấm "Show answer" để xem đáp án. Nút "I said it right" nếu STT nghe sai.
2. **3 mức**: Correct (giữ từ của bạn) / Natural / Level up.
3. **Tối đa 3 lỗi**, mỗi lỗi có nhãn và 1 dòng tiếng Việt. Nhãn:
   `grammar`, `word`, `natural`, `tone` (nghe cộc, cần nói mềm hơn),
   `vietlish` (dịch từng chữ từ tiếng Việt).
4. **Say it again**: nói lại bản Natural, chấm word diff.
5. Flow Mode: cuối buổi chỉ hiện **top 5 lỗi của cả buổi**, bấm từng lượt mới
   xem chi tiết.

### Mức độ của một cụm từ

`new` → `recognized` (Matching đúng) → `recalled` (điền/nói ra đúng) →
`prompted` (dùng đúng trong Talk khi đang có checklist) → `active` (tự dùng
đúng trong một buổi khác, khi cụm đó **không** nằm trên checklist).

Active là thước đo vốn từ thật. Hiện số này ở trang Talk.

---

## V1

### Phase 1 - Topic + Learn - CODE XONG (2026-11-20), CHƯA DEPLOY

Đã làm: `/talk`, `talkTopic`, Learn (Cards → Match → Recall), tiến độ cụm,
rules, link sidebar, Guide. Test: `src/lib/talk/talk.test.ts`,
`talk-topic.test.ts`, `talk-learn.test.ts`. Giọng đọc tạm dùng `speechSynthesis`;
Chirp 3 HD chuyển sang Phase 2. Còn lại: deploy function + rules, thử với topic thật.


Việc cần làm:
- Trang `/talk`: danh sách topic (có sẵn + custom), chọn level, nút tạo custom topic.
- Topic có sẵn (khoảng 10): 1:1 với manager, daily standup, báo cáo sự cố
  production, code review, phỏng vấn backend, small talk đầu cuộc họp, từ chối
  / phản biện lịch sự, giải thích kỹ thuật cho PM, ước lượng task, xin nghỉ / báo trễ.
- Cloud Function `talkTopic`: từ tiêu đề + mô tả + level, tạo 40 cụm
  (4 set × 10), mỗi cụm có IPA, nghĩa tiếng Việt, câu ví dụ trong đúng topic.
  Cũng tạo nhân vật (tên, vai, tính cách) và câu mở đầu. Lưu lại, tạo 1 lần.
- Topic có sẵn cũng tạo bằng `talkTopic` ở lần mở đầu tiên (không viết tay 400 cụm).
- Màn Learn: thẻ (có nút nghe TTS) → Matching → điền chỗ trống → nói ra cụm.
- Cho xoá cụm thấy lạ / không tự nhiên.
- Logic thuần + test: `src/lib/talk/learnQueue.ts` (hàng đợi, sai thì về cuối,
  khi nào xong set), `src/lib/talk/cloze.ts` (tạo câu điền chỗ trống từ câu ví dụ).
- Link "Talk" ở cuối sidebar. Cập nhật `src/app/guide/page.tsx`.

Prompt `talkTopic` (ý chính):
- Cụm **phổ biến, hay dùng trong công việc tech thật**. Ưu tiên collocation
  (động từ + danh từ, cụm nối câu), không ưu tiên từ đơn hiếm.
- Hợp level. Câu ví dụ ngắn (≤ 15 từ), đúng ngữ cảnh topic.
- Không trùng nhau. Nghĩa tiếng Việt ngắn, tự nhiên.

Kiểm tra: lint, unit test, build. Thử 2 topic có sẵn + 1 custom.

### Phase 2 - Talk + review mỗi lượt

Việc cần làm:
- Màn Talk: câu của nhân vật (TTS + nút hiện tiếng Việt), nút mic (Space),
  checklist cụm, Hint tầng 1 (2-3 cụm trong set hợp với câu hỏi, chọn ở client,
  miễn phí).
- Dùng lại `useVoiceRecorder` và `blobToBase64`.
- Cloud Function `talkTurn`: nhận audio + vài lượt trước (chỉ text) + cụm
  chưa dùng + level + mode + có cần curveball không. Trả về:
  - `transcript` (đúng từng chữ, giữ lỗi), `durationSec`
  - `reply`: `{ text, vi, curveball }` (câu nhân vật nói tiếp, dựa vào ý bạn vừa nói)
  - `review`: `{ correct, natural, levelUp, fixes[≤3] }`, mỗi fix có
    `{ kind, wrong, right, vi, pattern }`. `wrong` phải là đoạn có thật trong
    transcript (để gạch vàng).
  - `usedPhrases`: id các cụm trong danh sách mà bạn đã dùng đúng (kể cả đổi dạng).
- `pattern` chọn từ danh sách cố định (ví dụ `plural_s`, `present_perfect`,
  `article`, `preposition`, `verb_form`, `word_order`, `vietlish`, `tone`,
  `other`). Cần cố định để gom ngân hàng lỗi.
- Instant Review / Flow Mode (nút gạt, nhớ lựa chọn). Self-Repair (nút gạt).
- Curveball: client quyết định lượt nào (logic thuần, có test), gửi cờ cho function.
- Say it again: Web Speech + `checkParagraph`.
- Logic thuần + test: `src/lib/talk/fixSpans.ts` (tìm vị trí `wrong` trong
  transcript để gạch vàng, bỏ qua nếu không thấy), `src/lib/talk/curveball.ts`,
  `src/lib/talk/hints.ts`.
- Dùng `takeAiCall` (giới hạn 200 lần/ngày chung cho cả app). Talk dùng khoảng
  10 lần/buổi nên đủ.

Rủi ro cần test trước khi làm UI:
- Transcript có giữ lỗi không? Thử 10 câu cố ý nói sai.
- Gemini có bịa câu không (xem memory về argon)? Kiểm tra shape giống
  `normalizeSpeakingAssessment`, sai thì retry 1 lần.
- Thời gian chờ: mục tiêu ≤ 5 giây/lượt. Nếu chậm quá, V2 tách `reply` và
  `review` thành 2 lần gọi song song.

### Phase 3 - Notes + ngân hàng lỗi + Chốt hạ

Việc cần làm:
- Cloud Function `talkWrap` (1 lần/buổi, chỉ gửi text các lượt): `missedChances`
  (lượt nào lẽ ra dùng được cụm nào), `swaps` (từ hay dùng → nên thay),
  `closingPicks` (3 lượt lủng củng nhất, có câu tiếng Việt + bản Natural).
- Trang Notes: Used / Missed chances / Swap list / top 3 lỗi lặp lại / Chốt hạ 60s.
- Ngân hàng lỗi: gom `fixes` theo `pattern`. Warm-up buổi sau có 3-5 câu luyện
  đúng các pattern đó (lấy từ chính câu sai cũ, không gọi AI). Đúng 5 lần liền
  thì pattern "tốt nghiệp".
- Cập nhật mức độ cụm từ (`prompted`, `active`).
- Lưu lỗi vào trang Mistakes có sẵn (thêm một nhóm "Talk").
- Logic thuần + test: `src/lib/talk/phraseStage.ts`, `src/lib/talk/mistakeBank.ts`,
  `src/lib/talk/sessionStats.ts` (số từ/lượt, từ/phút từ transcript + thời lượng).

### Phase 4 - Hộp "Vừa bị bí" (Capture)

Việc cần làm:
- Nút nhỏ trên trang `/talk` (và trong menu sidebar): gõ hoặc nói tiếng Việt
  (Web Speech `vi-VN`), lưu lại. Mất 5 giây.
- Chỉ lưu và hiện danh sách. Dựng buổi luyện từ hộp này để V2.
- Lý do làm sớm: dữ liệu cần thời gian tích luỹ.

---

## Dữ liệu (Firestore)

Tất cả dưới `users/{uid}/`. Truy cập qua `src/lib/db/talk.ts` (export từ `@/lib/db`).

```ts
// talkTopics/{topicId}
type TalkTopic = {
  title: string; description: string; kind: 'preset' | 'custom';
  level: 'B1' | 'B2' | 'C1';
  persona: { name: string; role: string; style: string };
  opening: { text: string; vi: string };
  phrases: TalkPhrase[];          // 40, chia set theo setIndex (10 cụm/set)
  version: number; createdAt: number;
};
type TalkPhrase = {
  id: string; text: string; ipa: string; vi: string; example: string;
  setIndex: number; removed?: boolean;
};

// talkPhraseProgress/{phraseId} - riêng để tìm cụm Active giữa các topic
type TalkPhraseProgress = {
  topicId: string; text: string;
  stage: 'new' | 'recognized' | 'recalled' | 'prompted' | 'active';
  starred?: boolean; usedCount: number; lastUsedAt?: number;
};

// talkSessions/{sessionId}
type TalkSession = {
  topicId: string; setIndex: number; level: string;
  mode: 'instant' | 'flow'; selfRepair: boolean;
  turns: TalkTurn[];              // ≤ 10, đủ nhỏ cho một doc
  wrap?: TalkWrap; startedAt: number; endedAt?: number;
};
type TalkTurn = {
  ai: { text: string; vi: string; curveball: boolean };
  transcript: string; durationSec: number;
  review: { correct: string; natural: string; levelUp: string; fixes: TalkFix[] };
  usedPhraseIds: string[]; dismissedFixes?: number[]; retryPercent?: number;
};
type TalkFix = { kind: 'grammar' | 'word' | 'natural' | 'tone' | 'vietlish';
  wrong: string; right: string; vi: string; pattern: string };

// talkMistakes/{pattern}
type TalkMistake = { pattern: string; hits: number; cleanStreak: number;
  examples: { wrong: string; right: string; sessionId: string }[] };  // ≤ 10 mới nhất

// talkCaptures/{id}
type TalkCapture = { textVi: string; createdAt: number; usedInSessionId?: string };
```

Cập nhật `firestore.rules` cho các collection mới.

## Chi phí ước tính

Giá `gemini-3.8-flash` (tra ngày 2026-11-20, kiểm tra lại trên ai.google.dev/pricing):
$0.75 vào / $3.75 ra mỗi 1M token đến hết 2026-12-31, **từ 2027-01-01 tăng
gấp đôi** thành $1.50 / $7.50 (bằng giá Gemini 4 Hydrogen).

Một lượt `talkTurn`: audio ~15 giây (~500 token) + text ~1.5k token vào,
~600 token ra.

| Mức dùng | Token/tháng (vào / ra) | Giá 2026 | Giá từ 2027 |
|---|---|---|---|
| 25 lượt/ngày (~15-20 phút) | 1.5M / 0.45M | ~$2.8 (~75k VND) | ~$5.6 (~150k VND) |
| 40 lượt/ngày (~30 phút) | 2.4M / 0.7M | ~$4.4 (~115k VND) | ~$8.9 (~230k VND) |

Từ 2027, dùng 30 phút mỗi ngày sẽ vượt ngân sách 200k. Cách giữ chi phí thấp:
- Tắt hoặc để thinking ở mức thấp nhất (thinking token tính như token ra).
- Context caching cho phần prompt cố định (persona, danh sách cụm): giá cache
  chỉ khoảng 10%.
- Chỉ gửi 3 lượt gần nhất, không gửi cả buổi.
- Giữ review ngắn: tối đa 3 lỗi, mỗi dòng tiếng Việt ngắn.
- Thử Flash-Lite cho `talkTurn` nếu nó giữ được transcript đúng từng chữ.
- Thêm số token (vào, ra, thinking) vào log của function để biết chi phí thật.

`talkTopic`, `talkWrap`, TTS (trong free tier): rất nhỏ.

Model khác (không dùng cho Talk):
- Gemini 4 **Argon**: $4 / $20 từ 2026-12-01, và đã bịa câu trên audio thật.
- Gemini 4 **Neon**: mạnh nhất nhưng $3 / $15, khoảng 2-3 lần giá Flash.
- Gemini 4 **Hydrogen**: giá bằng 3.8 Flash từ 2027. Có thể A/B với Flash
  ở Phase 2 (chất lượng review, giữ lỗi trong transcript) rồi chọn một.

---

## V2 (sau 2-3 tuần dùng thật V1)

Chọn theo những gì thấy thiếu khi dùng. Gợi ý thứ tự:
1. **Meeting prep + Live Context**: dán ghi chú / ticket, tạo topic, ghim lên màn hình khi nói.
2. **Dựng buổi luyện từ hộp Capture**: gom 5-7 câu bị bí trong tuần.
3. **Làm lại bài sau 2-3 ngày**, đặt lần cũ và lần mới cạnh nhau.
4. **Time Capsule**: mỗi tháng 1 đề cố định 60 giây, lưu audio, nghe so sánh.
5. **Read-to-Speak**: dán Slack thread / PR, ẩn đi, nói tóm tắt 60 giây, AI kiểm tra thiếu ý.
6. **Khung BLUF / STAR**: tự gắn theo loại topic, chỉ nhận xét câu trả lời dài.
7. **Chế độ 5 phút** + streak có ngày nghỉ.
8. **Stalling phrases**: bộ cụm câu giờ ghim sẵn, kèm đếm "uh/um" (cần transcript Gemini).
9. **Hint tầng 2**: gỡ bí bằng tiếng Việt.
10. **4/3/2 (60s → 45s → 30s)**, kiểm tra cả "còn đủ ý chính".
11. **Signature Phrasebook**: gắn sao cụm "hợp miệng", theo dõi riêng.
12. **Đẩy cụm sang Anki** (dùng skill `anki-import`). Cụm Active thì không đẩy.
13. **Báo cáo tuần**.

## Backlog (có thể không bao giờ làm)

- Taboo (nói vòng khi bị cấm từ).
- Curveball nhiều nhân vật (PM chen vào). Chế độ họp 2 nhân vật đầy đủ.
- Giải thích cho 2 đối tượng (senior / PM).
- Chế độ luyện riêng "nói khéo" (trong V1 đã có nhãn `tone`).
- Tuỳ chọn giọng vùng miền và tốc độ TTS.
- Google Cloud TTS thay giọng trình duyệt.
- Nối cụm từ hay từ dictation/shadowing sang Talk.

## Không làm

- **Walk & Talk** (rảnh tay): trình duyệt điện thoại dừng trang khi khoá màn
  hình, tự ngắt sau 2-3 giây im lặng sẽ cắt ngang lúc đang nghĩ, ngoài đường ồn.
- Xu, cửa hàng, bảng xếp hạng, huy hiệu.
- Chấm phát âm từng âm (phoneme).
- Voice realtime.

## Câu hỏi còn mở

- Số lượt mỗi buổi: 8 hay để chọn 6/8/10?
- Topic có sẵn: danh sách 10 ở Phase 1 đã đủ chưa?
