/**
 * Group 12: Space Handling - typing spaces, cursor position at boundaries,
 * backspace across spaces, display after auto-insert.
 *
 * Regression guard for: auto-spacing feature eating typed spaces, causing
 * the cursor to freeze at word boundaries with no visual feedback.
 *
 * Uses sentence 0 ("the cat sat on the mat", 22 chars).
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, LESSON_SENTENCES, CHAR_DELAY_MS,
  activateClean, completeTyping, pressEnter, countSpans, countStars,
  isRowCompleted, dismissModal,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 12. Space Handling ───');
  await dismissModal(page);
  const idx = 0;
  const target = LESSON_SENTENCES[idx]; // "the cat sat on the mat"

  // ── 12a. Typing space at word boundary advances cursor ──────────────────────
  await check(report, '12a. Space at word boundary advances cursor', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type "the" then space
    await ta.pressSequentially('the', { delay: CHAR_DELAY_MS });
    await ta.pressSequentially(' ', { delay: CHAR_DELAY_MS });

    // Cursor should now be at position 4 (after the space), not position 3
    return page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      const spans = row.querySelectorAll('span');
      // Count green spans: t, h, e, space = 4
      const green = row.querySelectorAll('span.text-emerald-500');
      // The cursor (animate-pulse) should be AFTER the space position
      const cursor = row.querySelector('.animate-pulse');
      if (!cursor) return false;
      // 4 green spans means cursor is at position 4, past the space
      return green.length === 4;
    }, idx);
  });

  // ── 12b. Space fills the gap between words ─────────────────────────────────
  await check(report, '12b. Space shows as green between words', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('the ', { delay: CHAR_DELAY_MS });
    // The space position (index 3) should be emerald green
    return page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      const feedback = row.querySelector('[aria-hidden]');
      if (!feedback) return false;
      const spans = feedback.querySelectorAll(':scope > span, :scope > :not(span) > span');
      // Position 3 is the space - check it's green, not gray
      const allGreen = feedback.querySelectorAll('span.text-emerald-500');
      const allGray = feedback.querySelectorAll('span.text-gray-500');
      // We should have 4 green (t, h, e, space) and the rest gray
      return allGreen.length === 4;
    }, idx);
  });

  // ── 12c. Auto-space without typing space also works ─────────────────────────
  await check(report, '12c. Auto-space: typing letters across boundary works', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type "thec" - no space, but display should show "the c" with auto-space
    await ta.pressSequentially('thec', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    // Should be 5 green: t, h, e, (auto-space), c
    return green === 5;
  });

  // ── 12d. Typing space then continuing to type ──────────────────────────────
  await check(report, '12d. Type word + space + next letter works', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('the c', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    return green === 5 && red === 0;
  });

  // ── 12e. Multiple words with explicit spaces ───────────────────────────────
  await check(report, '12e. Multiple words with explicit spaces all green', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('the cat sat', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    // "the cat sat" = 11 chars (9 letters + 2 spaces)
    return green === 11 && red === 0;
  }, 10_000);

  // ── 12f. Completion with all explicit spaces typed ─────────────────────────
  await check(report, '12f. Completion with explicit spaces typed', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type the full answer WITH spaces
    await ta.pressSequentially('the cat sat on the mat', { delay: CHAR_DELAY_MS });
    return isRowCompleted(page, idx);
  }, 20_000);

  await pressEnter(page).catch(() => {});

  // ── 12g. Completion without any spaces typed ───────────────────────────────
  await check(report, '12g. Completion without any spaces typed', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('thecatsatonthemat', { delay: CHAR_DELAY_MS });
    return isRowCompleted(page, idx);
  }, 20_000);

  await pressEnter(page).catch(() => {});

  // ── 12h. Backspace after auto-inserted space removes letter ────────────────
  await check(report, '12h. Backspace after auto-space removes previous letter', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type "thec" → displays "the c" (5 green)
    await ta.pressSequentially('thec', { delay: CHAR_DELAY_MS });
    const greenBefore = await countSpans(page, idx, 'text-emerald-500');
    // Backspace removes 'c'; auto-inserted boundary space stays → "the " (4 green)
    await ta.press('Backspace');
    await sleep(150);
    const greenAfter = await countSpans(page, idx, 'text-emerald-500');
    return greenBefore === 5 && greenAfter === 4;
  });

  // ── 12i. Backspace after typed space removes the space ─────────────────────
  await check(report, '12i. Backspace after typed space returns to pre-space', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type "the " (with space) → 4 green
    await ta.pressSequentially('the ', { delay: CHAR_DELAY_MS });
    const greenBefore = await countSpans(page, idx, 'text-emerald-500');
    // Backspace → back to "the" (3 green)
    await ta.press('Backspace');
    await sleep(100);
    const greenAfter = await countSpans(page, idx, 'text-emerald-500');
    return greenBefore === 4 && greenAfter === 3;
  });

  // ── 12j. Tab hint at word boundary includes space ──────────────────────────
  await check(report, '12j. Tab hint after last letter of word auto-spaces', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type "the" then Tab → fills 'c' and auto-space → "the c" (5 green)
    await ta.pressSequentially('the', { delay: CHAR_DELAY_MS });
    await ta.press('Tab');
    await sleep(150);
    const green = await countSpans(page, idx, 'text-emerald-500');
    return green === 5;
  });

  // ── 12k. No gray stars at space positions that have been typed past ────────
  await check(report, '12k. No gray stars remain at passed space positions', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('thecat', { delay: CHAR_DELAY_MS });
    // Should be: "the cat" (7 chars, all green). No gray stars in the typed region.
    return page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      const feedback = row.querySelector('[aria-hidden]');
      if (!feedback) return false;
      const grayStars = [...feedback.querySelectorAll('span.text-gray-500')].filter(
        (s) => s.textContent === '*',
      );
      const green = feedback.querySelectorAll('span.text-emerald-500');
      // 7 green (t,h,e,space,c,a,t) and remaining gray (not in typed region)
      return green.length === 7 && grayStars.length > 0;
    }, idx);
  });

  // ── 12l. Wrong char at space position shows red ────────────────────────────
  await check(report, '12l. Wrong char display: red at expected positions', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type "thx" → t(green) h(green) x(red at 'e' position)
    await ta.pressSequentially('thx', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    return green === 2 && red === 1;
  });

  // cleanup
  await activateClean(page, idx);
  await completeTyping(page, idx);
  await pressEnter(page).catch(() => {});
}
