# PLAN-motion - noda: chuyển động và tương tác

Viết ngày 2026-10-19 để giao cho một AI khác làm (hoặc làm trong phiên
này). Owner chưa duyệt: hỏi owner trước khi bắt đầu P1.

## Prompt để dán cho AI làm

```
Work in /Users/kyphan/ws/app/noda. Read ws/app/AGENTS.md, noda/AGENTS.md,
ws/app/DESIGN.md (sections "Motion" and "Layout") and noda/PLAN-motion.md
first. Implement only phase <P1> from PLAN-motion.md, exactly as written.
Follow "Quy tắc cho mọi phase", "CSS dùng chung" and "Lỗi hay gặp". Run
every command in "Kiểm tra mỗi phase" and fix all failures you caused. Then
update the Motion section in README.md and the "Tiến độ" list, commit only
the files you changed on main (no Co-Authored-By), push, and stop. Tell me
in Vietnamese, in short simple sentences, what changed and how to try it.
Do not start the next phase.
```

Đổi `<P1>` thành phase muốn làm. Mỗi lần chỉ một phase.

## Đọc trước khi làm

1. `ws/app/AGENTS.md` và `noda/AGENTS.md`: không em dash (U+2014), code và
   comment bằng tiếng Anh, chữ trên UI càng ít càng tốt, không ghi
   `Co-Authored-By`.
2. `ws/app/DESIGN.md`, phần **Motion**: easing, thời lượng, quy tắc. Plan
   này chỉ áp dụng phần đó cho noda.
3. `logi/PLAN-motion.md` và code logi (`src/lib/motion.ts`,
   `src/hooks/usePresence.ts`, `src/hooks/useIndicator.ts`,
   `src/components/Toasts.tsx`): logi đã làm xong cùng hệ thống này. Copy
   cách làm, không import chéo repo.
4. Luật riêng của noda phải giữ:
   - **Gõ là trên hết.** Không hiệu ứng nào được làm chậm việc gõ, làm mất
     focus của ô nhập, hay chạy JS mỗi phím. Hiệu ứng theo phím chỉ là CSS.
   - **Chỉ xám** (DESIGN.md). Đúng/sai bằng độ đậm và chữ, không màu. Năm
     badge shadowing (`NOTE_BADGE_CLASS`) giữ nguyên.
   - **Dòng không được nhảy.** `TranscriptSentence` cố tình giữ cỡ chữ giống
     nhau khi active và không active (comment trong file). Không đổi cỡ, độ
     đậm hay padding theo trạng thái.

**Sửa lại so với lúc chat:** noda **không có màn flashcard** (chỉ còn dấu
vết cũ trong `lib/db.ts`). Ba chế độ là Dictation, Listen, Shadowing. Plan
này không có "lật thẻ".

## Hiện trạng (2026-10-19)

- `app/globals.css` có: `modeContentFadeIn` (420ms, dài hơn mức 300ms của
  DESIGN.md), `modalBackdropIn` / `modalPanelIn` (280ms / 380ms), shimmer
  cho skeleton (gradient chạy mãi), thanh chạy mãi khi phân tích IPA
  (`noda-ipa-bar-fill`), toast trượt vào từ phải. Khối
  `prefers-reduced-motion` chỉ tắt từng class một.
- Modal và toast **chỉ có hiệu ứng vào**, không có hiệu ứng ra.
- Con trỏ khi gõ dictation dùng `animate-pulse` (nhấp nháy 2s).
- Khi gõ đúng hay sai một chữ: chỉ đổi class, không có phản hồi chuyển động.
- Thanh tiến độ bài học ở sidebar (`LessonProgressBars`) dùng `width`.
- Sidebar trên điện thoại trượt vào bằng `transform` (tốt). Trên máy tính cột
  sidebar animate `width` (300ms).
- `package.json` có thư viện `motion` nhưng **không file nào dùng**. Không
  dùng nó (DESIGN.md: không thư viện animation).
- Test: `vitest` cho logic (`scripts/test-dictation/__tests__`), Playwright
  E2E cho dictation (`npm run test:dictation`, cần `npm run dev:e2e` ở port
  3010). Có `@testing-library/react` nhưng vitest chỉ chạy file `.test.ts`
  trong thư mục trên.
- `NEXT_PUBLIC_E2E_MODE=true` (lệnh `npm run dev:e2e`) **bỏ qua đăng nhập**.
  Nhờ vậy AI thử được app thật trên trình duyệt, không cần Google.

## Quy tắc cho mọi phase

- Theo đúng phần **Motion** trong DESIGN.md: chỉ `opacity` và `transform`
  (và `stroke-dashoffset` trong SVG), reduced motion phải chạy, không vòng
  lặp gây chú ý, không thư viện.
- Mỗi cử chỉ phải có cách thay thế (nút, phím, chữ có sẵn).
- Không đổi logic dictation, playback, Firestore, shadowing AI. Chỉ đổi UI.
  Hàm thuần mới phải có test vitest.
- Không đổi chữ trên UI, trừ khi plan ghi rõ.
- Rung: `navigator.vibrate?.(ms)`. iPhone bỏ qua là đúng.
- Mỗi phase xong: cập nhật phần **Motion** trong `README.md` (tạo mới nếu
  chưa có, ngắn, tiếng Anh), ghi một dòng vào "Tiến độ" cuối file này, rồi
  **hỏi owner trước khi làm phase tiếp theo**.

## Kiểm tra mỗi phase

```bash
cd ws/app/noda
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

E2E (chạy dev server E2E trước, trong một tab khác hoặc chạy nền):

```bash
npm run dev:e2e
```

```bash
npm run test:dictation
```

- **Chạy E2E một lần trước khi sửa** và lưu kết quả (số pass/fail) làm mốc.
  Một số test cũ còn tìm `text-emerald-500` / `text-red-500` (từ trước khi
  chuyển sang chỉ xám), nên có thể đã fail sẵn. Chỉ cần không có test **mới**
  fail do mình. Lưu output ra file rồi so số, đừng chỉ đọc dòng cuối.
- Thử trên trình duyệt: thêm cấu hình vào `.claude/launch.json` (tạo nếu
  chưa có): tên `noda-e2e`, `npm run dev:e2e`, port 3010. Không cần đăng
  nhập. Thử màn 375px và màn rộng, và một lần với reduced motion bật.
- Commit: chỉ add đúng đường dẫn đã sửa (`git add <file> ...`, không
  `git add -A`). Kiểm tra `git branch --show-current` là `main` trước khi
  commit. Message dạng `feat(motion): ...`. Không co-author. Push lên
  `main` thì Vercel tự deploy.

## Chỗ sửa chính (vị trí ngày 2026-10-19, có thể lệch vài dòng)

| Chỗ | File | Phase |
|---|---|---|
| Các keyframe hiện có, khối reduced motion | `app/globals.css:244-455` | P1 |
| Skeleton | `components/LoadingSkeleton.tsx`, `app/page.tsx:1059` | P1 |
| Toast | `components/Toast.tsx`, chỗ render trong `app/page.tsx` | P1 |
| 4 modal | `DeleteLessonModal`, `DeleteManyModal`, `CleanupModal`, `NewLessonModal` | P2 |
| Tab chế độ | `components/AppHeader.tsx:64-80`, `.mode-tab` trong `globals.css:176-216` | P2 |
| Sidebar điện thoại | `components/Sidebar.tsx:250-270` | P2 |
| Ô gõ và phản hồi từng chữ | `components/DictationControls.tsx:120-190` | P3 |
| Dòng câu, icon xong | `components/TranscriptSentence.tsx` | P3 |
| Thanh tiến độ bài học | `components/LessonProgressBars.tsx` | P4 |
| Modal "Lesson complete!" | `components/CleanupModal.tsx` | P4 |
| Nút Play/Pause | `components/Player.tsx:266-278` | P4 |
| Panel shadowing pattern | `components/ShadowingPatternDock.tsx`, `LessonView.tsx:518,537` | P4 |

## CSS dùng chung (thêm vào `globals.css`)

Thêm token vào `:root` (một lần):

```css
  --ease-soft: cubic-bezier(0.22, 1, 0.36, 1);
```

Thêm khối Motion (đặt trước khối `prefers-reduced-motion`). Tên giống mora
và logi:

```css
/* ---- Motion: short, opacity/transform only (DESIGN.md "Motion") ---- */
@keyframes fade-in {
  from { opacity: 0; }
}
.fade-in {
  animation: fade-in 180ms ease-out both;
}

@keyframes fade-out {
  to { opacity: 0; }
}
.fade-out {
  animation: fade-out 200ms ease-in both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(6px); }
}
.rise {
  animation: rise 240ms var(--ease-soft) both;
}

@keyframes pop {
  from { opacity: 0; transform: scale(0.7); }
}
.pop {
  animation: pop 180ms var(--ease-soft) both;
}

/* A slow fade in and out for "loading" or "waiting"; never blinks. */
@keyframes breathe {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
.breathe {
  animation: breathe 3.2s ease-in-out infinite;
}

/* P1: modals and toast leaving. */
@keyframes panel-out {
  to { opacity: 0; transform: translateY(8px) scale(0.98); }
}
.app-modal-panel.is-leaving {
  animation: panel-out 180ms ease-in both;
}
.app-modal-backdrop.is-leaving {
  animation: fade-out 200ms ease-in both;
}
@keyframes toast-out {
  to { opacity: 0; transform: translateX(24px); }
}
.toast.is-leaving {
  animation: toast-out 200ms ease-in both;
  pointer-events: none;
}

/* P3: dictation feedback, one character at a time. */
@keyframes char-in {
  from { opacity: 0.3; transform: translateY(2px); }
}
.char-in {
  display: inline-block;
  animation: char-in 120ms ease-out both;
}
@keyframes char-wrong {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-2px); }
  70% { transform: translateX(2px); }
}
.char-wrong {
  display: inline-block;
  animation: char-wrong 160ms ease-out both;
}
/* Steady while typing; after 1.2s with no key it breathes. Each key moves
   the caret to a new element, so the delay starts again by itself. */
.dictation-caret {
  animation: breathe 3.2s ease-in-out 1.2s infinite;
}

/* P4: the "Lesson complete!" icon. */
@keyframes ring-out {
  from { transform: scale(1); opacity: 0.5; }
  to { transform: scale(1.35); opacity: 0; }
}
.ring-out {
  animation: ring-out 900ms ease-out 200ms both;
  pointer-events: none;
}
```

Thay khối `@media (prefers-reduced-motion: reduce)` hiện có bằng khối
chung (giữ dòng `scroll-behavior` cũ):

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

Khối này phải nằm **sau** mọi keyframe và class motion.

## Lỗi hay gặp (đọc kỹ)

1. **Hiệu ứng theo phím không được dùng JS.** Không `setTimeout`, không
   `el.animate`, không state mới mỗi phím trong `DictationControls`. Chỉ
   đổi `key` và class để CSS tự chạy.
2. **React dùng lại thẻ `span`.** Trong `DictationControls`, ba nhánh
   (`*`, đúng, sai) đều là `<span>` ở cùng chỗ, nên React chỉ đổi class trên
   cùng một thẻ và animation **không chạy lại**. Muốn chạy thì cho mỗi trạng
   thái một `key` riêng (xem P3.1).
3. **Mở bài đã gõ dở thì không được chạy hàng loạt.** Chỉ chữ **vừa gõ**
   (vị trí `inputNorm.length - 1` trên dòng active) mới có hiệu ứng. Các chữ
   cũ hiện đứng yên.
4. **E2E tìm con trỏ bằng `.animate-pulse`** (`02-input.ts:52`,
   `12-space-handling.ts:41`). Khi đổi con trỏ (P3.3), thêm `data-caret` và
   sửa hai test đó sang `[data-caret]`. Đừng giữ `animate-pulse` chỉ để test
   qua.
5. **E2E tìm `.app-modal-backdrop`** (`helpers.ts:277`) rồi bấm Escape và
   chờ 300ms. Hiệu ứng ra của modal phải xong dưới 300ms (plan dùng 200ms).
6. **Focus.** Ô nhập dictation được focus trong `useLayoutEffect`. Không bọc
   nó trong phần tử có `animation` đổi `visibility` hay `display`; không
   thêm `autoFocus` mới.
7. **`transform` trên chữ inline không chạy.** `char-in`, `char-wrong` cần
   `display: inline-block` (đã có trong CSS). Bọc từng chữ, không bọc cả từ,
   để xuống dòng không đổi (`17-word-wrap.ts` kiểm tra việc này).
8. **`button:active` đã có `transform: scale(0.98)`** cho mọi nút
   (`globals.css`). Đừng thêm `active:scale-*` trùng lên.
9. **Hydration.** App là static export. Đừng đọc `matchMedia` lúc render đầu
   rồi đổi class theo nó. Đọc trong effect hoặc lúc có sự kiện.
10. **Không em dash.** Kiểm tra trước khi commit (zsh):
    `grep -rn $'\xe2\x80\x94' app components hooks lib scripts PLAN-motion.md README.md`
    phải rỗng.

---

## P1 - Nền móng: CSS, hook, skeleton, toast ra

### P1.1 CSS

File: `app/globals.css`.

- Thêm `--ease-soft` và khối Motion như "CSS dùng chung" (P1 chỉ cần tới
  phần toast; thêm luôn cả khối cho gọn cũng được).
- Rút ngắn cho đúng DESIGN.md: `.mode-content-fade` 420ms -> 240ms
  (`var(--ease-soft)`), `.app-modal-backdrop` 280ms -> 180ms,
  `.app-modal-panel` 380ms -> 220ms. Giữ keyframe cũ, chỉ đổi thời lượng.
- Thay khối reduced motion như trên.

### P1.2 Hàm và hook

File mới: `lib/motion.ts`, `hooks/usePresence.ts`, test
`scripts/test-dictation/__tests__/motion.test.ts`.

- `lib/motion.ts`: `reducedMotion()` (trả `true` khi không có
  `matchMedia`), copy từ `logi/src/lib/motion.ts`. Các hàm của phase sau
  thêm vào đây.
- `hooks/usePresence.ts`: copy từ `logi/src/hooks/usePresence.ts` (bản tính
  state lúc render, không setState trong effect), import `reducedMotion` từ
  `@/lib/motion`.
- Test: `reducedMotion()` trả `true` trong Node.

### P1.3 Skeleton thở chậm

File: `components/LoadingSkeleton.tsx`, `app/page.tsx:1059-1060`,
`globals.css`.

- Đổi `skeleton-shimmer` thành nền xám tĩnh + `breathe`. Cách gọn nhất: sửa
  chính class `.skeleton-shimmer` trong CSS (nền
  `color-mix(in srgb, var(--g-700) 45%, transparent)`, bỏ gradient, dùng
  `animation: breathe 3.2s ease-in-out infinite`). Không cần sửa JSX.
- Thanh IPA (`noda-ipa-bar-fill`) **giữ nguyên** trong phase này.

### P1.4 Toast có hiệu ứng ra

File: `components/Toast.tsx`, `app/page.tsx` (chỗ render `<Toast>`).

- Hiện nay `page.tsx` render `{toast && <Toast .../>}`, nên toast mất ngay
  khi `toast` thành `null`. Tạo `components/ToastLayer.tsx`: nhận
  `toast` (hoặc `null`) và `onClose`; giữ toast cuối cùng thêm 200ms với
  class `is-leaving` khi `toast` thành `null` (dùng `usePresence(open, 200)`
  và một state nhớ toast cuối, tính lúc render như `logi/Toasts.tsx`).
- Toast mới thay toast cũ (đổi message): toast mới vào ngay, không chờ cái
  cũ ra. Dùng `key` theo message + type.
- Bấm nút action (ví dụ Undo) hoặc nút X: toast vẫn ra bằng hiệu ứng (khác
  logi, vì noda toast nằm góc màn và không che gì).
- `Toast.tsx` nhận thêm prop `leaving?: boolean` để thêm class
  `is-leaving`.
- `page.tsx` render `<ToastLayer toast={toast} onClose={dismissToast} />`
  thay cho khối cũ.

Xong khi: một toast (ví dụ chuyển bài vào trash) trượt vào, sau 3 giây
trượt nhẹ sang phải và mờ đi; reduced motion thì hiện và mất ngay.

---

## P2 - Modal, tab chế độ, sidebar điện thoại

### P2.1 Modal có hiệu ứng ra

File: `DeleteLessonModal.tsx`, `DeleteManyModal.tsx`, `CleanupModal.tsx`,
`NewLessonModal.tsx`; file mới `components/ModalShell.tsx`.

- `ModalShell`: nền + panel, giữ đúng class hiện có (`app-modal-backdrop`,
  `app-modal-panel`, z-index, `backdrop-blur-sm` nơi nào đang có), portal
  nếu modal đó đang dùng `createPortal`. Props: `onClose`, `labelledBy`,
  `zIndex`, `panelClassName`, `children`.
- Đóng bằng bấm nền hoặc `Esc`: thêm `is-leaving` cho cả nền và panel, chờ
  200ms rồi mới gọi `onClose`. Reduced motion: gọi ngay.
- Nút bên trong (Keep, Delete, Cancel, Create) gọi thẳng như cũ, modal mất
  ngay. Đây là chủ ý: hành động xong thì toast là phản hồi.
- Giữ nguyên `autoFocus`, `role="dialog"`, `aria-modal`, cách bắt
  `mousedown` trên nền (không đổi sang `click`, vì kéo chọn chữ trong ô nhập
  rồi thả ra ngoài sẽ đóng nhầm).
- Chuyển từng modal sang `ModalShell`, thử từng cái.

### P2.2 Khối nền của tab chế độ trượt theo

File: `components/AppHeader.tsx`, `globals.css`, file mới
`hooks/useIndicator.ts` (copy từ `logi/src/hooks/useIndicator.ts`).

- Tab đang chọn (`.mode-tab.active`) hiện có nền và `box-shadow` riêng. Đổi
  thành **một** khối nền chung nằm trong `.mode-tabs`, trượt sang tab mới bằng
  `translateX` (260ms `var(--ease-soft)`), như logi `Tabs`.
- `.mode-tabs` thêm `position: relative`; khối nền `position: absolute`,
  `inset-block: 4px`, `border-radius: 9999px`, cùng màu nền và shadow như
  `.mode-tab.active` hiện nay (giữ đúng vẻ ngoài). `.mode-tab.active` bỏ
  `background` và `box-shadow`, giữ `color`.
- Tab có `data-active` cho hook tìm. Tab cần `position: relative` để chữ nằm
  trên khối nền.
- Lần đầu và khi đổi cỡ màn: khối đứng đúng chỗ, không trượt (hook đã lo).
- Nội dung chế độ vẫn `mode-content-fade` như cũ (đã rút còn 240ms ở P1).

### P2.3 Vuốt trái để đóng sidebar trên điện thoại

File: `components/Sidebar.tsx`. Hàm thuần thêm vào `lib/motion.ts`.

- Chỉ khi `isMobile && isOpen`.
- Vuốt sang trái trên panel sidebar: panel đi theo ngón tay
  (`translateX(dx)`, chỉ `dx < 0`; kéo sang phải thì cản `dx * 0.2`), lớp nền
  tối mờ dần theo `1 + dx / width`. Ghi `style` qua ref, không setState mỗi
  lần di chuyển.
- **Khoá hướng sau 8px đầu tiên**: nếu đi dọc nhiều hơn ngang thì bỏ, để
  danh sách bài học vẫn cuộn bình thường.
- Thả: đóng nếu `drawerShouldClose(dx, width, velocity)` đúng, nếu không thì
  bật về trong 200ms `var(--ease-soft)`. Đóng thì gọi `onToggle(false)`; panel
  đã có `transition-transform duration-300` để trượt tiếp ra ngoài.
- Không bắt đầu kéo khi chạm vào `input`, `button` có menu đang mở, hoặc ô
  đang đổi tên (`InlineCreateInput`).
- Cách thay thế: nút đóng và bấm nền tối vẫn như cũ.

```ts
/** Close the drawer past a third of its width, or on a fast flick left. */
export function drawerShouldClose(dx: number, width: number, velocityPxPerMs: number): boolean {
  return dx < -width / 3 || velocityPxPerMs < -0.5;
}
```

Test: `drawerShouldClose(-120, 288, 0)` là `true`; `(-40, 288, -0.1)` là
`false`; `(-40, 288, -0.8)` là `true`.

---

## P3 - Dictation: phản hồi từng chữ (phần quan trọng nhất)

File chính: `components/DictationControls.tsx`, `components/TranscriptSentence.tsx`.

### P3.1 Chữ đúng hiện lên nhẹ

- Trong vòng lặp ký tự (dòng ~125-145), mỗi nhánh có `key` riêng theo trạng
  thái: `${i}-empty`, `${i}-ok`, `${i}-bad`. Như vậy khi `*` đổi thành chữ
  đúng, React gắn thẻ mới và animation chạy một lần.
- Chỉ chữ vừa gõ có class: `const fresh = isActive && i === inputNorm.length - 1`.
  Chữ đúng và `fresh` thì thêm `char-in`. Các chữ khác không có class motion.
- Dấu cách gõ đúng: không cần hiệu ứng.
- Giữ nguyên class màu hiện có (`text-gray-100`, `text-gray-500`) vì E2E
  đếm theo chúng.
- Gợi ý (Tab hoặc nút bóng đèn) điền một chữ đúng: cũng là chữ mới nhất nên
  tự có `char-in`. Không cần làm riêng.

### P3.2 Chữ sai rung nhẹ một lần

- Chữ sai và `fresh` thì thêm `char-wrong` (lệch 2px trái phải, 160ms, một
  lần). Không lặp, không đổi màu.
- Dấu cách gõ sai (ô `bg-gray-700`): cũng `char-wrong` khi `fresh`.
- Rung máy: **không** rung mỗi lần sai (gõ nhanh sẽ rung liên tục). Bỏ qua.
- Xoá lùi (Backspace): không có hiệu ứng.

### P3.3 Con trỏ: đứng yên khi gõ, thở khi dừng

- Ba chỗ render con trỏ (`border-l border-gray-100 animate-pulse`): bỏ
  `animate-pulse`, thêm class `dictation-caret` và thuộc tính `data-caret`.
- Vì con trỏ được render ở vị trí mới sau mỗi phím (thẻ mới), animation có
  `delay 1.2s` sẽ tự bắt đầu lại: đang gõ thì đứng yên, dừng 1.2 giây thì
  thở chậm. Không cần JS.
- Sửa E2E: `02-input.ts` và `12-space-handling.ts` tìm `[data-caret]` thay
  cho `.animate-pulse`.

### P3.4 Câu xong: dòng lắng lại

File: `DictationControls.tsx` (nhánh `isCompleted`), `TranscriptSentence.tsx`.

- Khi một câu vừa gõ xong (đổi từ chưa xong sang xong **lúc đang xem**):
  câu đầy đủ (nhánh `isCompleted`) hiện bằng `fade-in`.
- Icon xong ở cột phải (`CheckCircle2`, `data-dictation-status-icon` và
  `data-shadowing-done-icon`) chạy `pop` khi nó **mới xuất hiện do người
  dùng làm xong**, không phải khi mở bài.
- Cách biết "vừa xong": trong `TranscriptSentence`, giữ state
  `prevDone` và `justDone`, tính lúc render:
  ```ts
  const [prevDone, setPrevDone] = useState(isCompleted);
  const [justDone, setJustDone] = useState(false);
  if (isCompleted !== prevDone) {
    setPrevDone(isCompleted);
    setJustDone(isCompleted);
  }
  ```
  Truyền `justDone` xuống `DictationControls` để thêm `fade-in`. Không cần
  reset `justDone` (class nằm trên thẻ đã gắn, không chạy lại). Nhớ
  `TranscriptSentence` đang được `React.memo`: state cục bộ vẫn chạy bình
  thường.
- Dòng tiếp theo thành active: giữ nguyên hành vi cuộn hiện có
  (`useAutoScrollActiveSentence`). Không thêm hiệu ứng cho khung dòng (khung
  đã có `transition duration-200`).
- Shadowing: bấm "done - next" (hoặc Enter) thì icon xong của dòng vừa qua
  `pop`, cùng cách trên.

Xong khi: gõ một câu trên màn 375px và màn rộng, chữ đúng hiện lên nhẹ, chữ
sai lắc nhẹ một lần, con trỏ đứng yên khi gõ và thở khi dừng; gõ xong câu
thì câu đầy đủ hiện mượt và icon xong nảy nhẹ; mở lại bài đã làm thì không
có gì chạy. E2E không có test mới fail.

---

## P4 - Tiến độ, hoàn thành, player, panel

### P4.1 Thanh tiến độ bài học đầy dần

File: `components/LessonProgressBars.tsx`.

- Đổi `style={{ width: value% }}` thành thẻ rộng 100% với
  `transform: scaleX(value / 100)`, `transform-origin: left`,
  `transition: transform 600ms var(--ease-soft)`.
- Khi đổi từ hai thanh sang dấu check (cả hai 100%): dấu check `pop`, chỉ
  khi đổi lúc đang xem (cùng cách `prevDone` ở P3.4). Mở app với bài đã xong
  thì check đứng yên.

### P4.2 "Lesson complete!": icon nảy và một vòng lan ra

File: `components/CleanupModal.tsx`.

- Ô tròn chứa icon `PartyPopper`: thêm `pop` với `animation-delay: 120ms`
  (sau khi panel vào).
- Phía sau ô tròn, thêm một vòng tròn mỏng cùng cỡ (`border` màu
  `var(--g-500)`, `position: absolute`, `inset: 0`, `rounded-full`) với class
  `ring-out`: lan ra và mờ đi một lần (900ms). Ô tròn cần `relative`.
- Không confetti, không lặp, không màu.
- Reduced motion: chỉ hiện modal, không có gì chạy.

### P4.3 Play/Pause đổi icon mượt

File: `components/Player.tsx:266-278`.

- Icon `Play` và `Pause` có `key` khác nhau và class `pop`, để khi đổi thì
  icon mới nảy nhẹ (180ms). Nút giữ nguyên kích thước.
- Phím Space (`useGlobalPlaybackShortcuts`) đổi trạng thái thì icon cũng
  nảy, vì cùng một chỗ render.

### P4.4 Panel shadowing pattern hiện lên

File: `components/ShadowingPatternDock.tsx`, `LessonView.tsx:518,537`.

- Khi panel mở (bấm nút AI ở player): khung ngoài của dock `rise`.
- Đóng: mất ngay (không cần hiệu ứng ra).
- Nội dung bên trong đổi (kết quả AI về): `fade-in` cho phần kết quả, một
  lần.

Xong khi: xong một câu thì thanh ở sidebar nhích dần; xong cả bài thì
modal hiện, icon nảy và một vòng lan ra; Play/Pause đổi icon mượt; panel AI
trượt lên nhẹ khi mở.

---

## Không làm (ghi lại để AI sau khỏi đề xuất lại)

- **Lật thẻ flashcard**: noda không có màn flashcard.
- **Dùng thư viện `motion`** có sẵn trong `package.json`: DESIGN.md không cho
  dùng thư viện animation. Có thể gỡ nó ở một việc riêng, không thuộc plan
  này.
- **Vuốt ngang để sang câu khác**: đụng với chọn chữ, cuộn và bàn phím điện
  thoại. Đã có Enter và nút "next".
- **Rung mỗi lần gõ sai**: gõ nhanh sẽ rung liên tục.
- **Đổi animation `width` của cột sidebar trên máy tính**: chạy ổn, đổi sang
  transform phải viết lại layout hai cột. Để sau nếu thấy giật.
- **Thanh chạy của phân tích IPA** (`noda-ipa-bar-fill`): là chỉ báo đang
  chờ AI, owner quyết sau có đổi sang chữ "analyzing" thở chậm hay không.
- **Confetti hay hiệu ứng ăn mừng lớn** khi xong bài.

## Tiến độ

(AI làm ghi một dòng mỗi phase: ngày, commit, ghi chú.)
- P1 (2026-10-19): Motion CSS block + `--ease-soft`, shorter mode/modal entries, one global reduced-motion block, skeleton `breathe`, `lib/motion.ts` + test, `usePresence`, `ToastLayer` with exit. E2E not run: Playwright browsers are not installed (`npx playwright install`, owner to approve). Toast and skeleton checked on a temporary page in E2E mode.
