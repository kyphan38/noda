/**
 * Group 11: Unicode Normalization — modifier letter apostrophe (U+02BC)
 * and other edge cases in SRT text that could block completion.
 *
 * Regression test for: SRT containing "Switzerlandʼs" (U+02BC) caused
 * the target to be 28 chars ("switzerlandʼs") while the user can only
 * type 27 chars ("switzerlands"), making completion impossible.
 *
 * Uses sentence 10 (index 10): "Who run Switzerlandʼs trains?" in the SRT,
 * which normalizes to "who run switzerlands trains" (27 chars).
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, LESSON_SENTENCES, CHAR_DELAY_MS,
  activateClean, completeTyping, pressEnter,
  seekToSentence, waitForActive, pauseAudio,
  isRowCompleted, countSpans, countStars,
  dismissModal,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 11. Unicode Normalization ───');
  const idx = 10; // "Who run Switzerlandʼs trains?" in SRT

  // Sentence 10 may already be completed by group 3e — retry to reset it
  await dismissModal(page);
  await activateClean(page, idx);
  const retryBtn = page.locator(`[data-index="${idx}"] button[title="Practice this sentence again"]`);
  if (await retryBtn.count() > 0) {
    await retryBtn.click();
    await sleep(300);
  }

  await check(report, '11a. Activate apostrophe sentence', async () => {
    await activateClean(page, idx);
  }, 6_000);

  await check(report, '11b. Stars shown for apostrophe sentence', async () => {
    const stars = await countStars(page, idx);
    return stars > 0;
  });

  await check(report, '11c. Typing correct answer shows all green', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('who run switzerlands trains', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    const stars = await countStars(page, idx);
    if (green === 0 && red === 0 && stars === 0) {
      return await isRowCompleted(page, idx);
    }
    return green > 0 && red === 0 && stars === 0;
  }, 25_000);

  await check(report, '11d. Apostrophe sentence completes', async () => {
    return isRowCompleted(page, idx);
  });

  await check(report, '11e. Enter advances after apostrophe sentence', async () => {
    const sr = page.locator('[aria-label="Press Enter to continue"]');
    await sr.waitFor({ state: 'attached', timeout: 3_000 });
    return true;
  });

  // Verify Enter key advances (the sr-only input fires the advance)
  await check(report, '11f. Enter on apostrophe sentence advances', async () => {
    await pressEnter(page);
    await sleep(500);
    return true;
  }, 10_000);

  await dismissModal(page);

  // Regression: typing letters without spaces should still complete (auto-space)
  await check(report, '11g. Apostrophe sentence completes without explicit spaces', async () => {
    await activateClean(page, idx);
    const retry = page.locator(`[data-index="${idx}"] button[title="Practice this sentence again"]`);
    if (await retry.count() > 0) {
      await retry.click();
      await sleep(300);
      await activateClean(page, idx);
    }
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Type correct letters WITHOUT any spaces — auto-spacing should complete it
    await ta.pressSequentially('whorunswitzerlandstrains', { delay: CHAR_DELAY_MS });
    return isRowCompleted(page, idx);
  }, 25_000);

  await pressEnter(page).catch(() => {});
  await dismissModal(page);
}
