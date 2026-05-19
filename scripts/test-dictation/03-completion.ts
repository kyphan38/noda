/**
 * Group 3: Completion Contract — marking done, Enter advance, last sentence.
 * Uses sentences 1, 2, 3, 4, 9.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, LESSON_SENTENCES, CHAR_DELAY_MS,
  SENTENCE_ENDS,
  activateClean, completeTyping, pressEnter, isRowCompleted,
  waitForActive, getAudioTime,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 3. Completion Contract ───');

  await check(report, '3a. Exact match triggers completion', async () => {
    await activateClean(page, 1);
    await completeTyping(page, 1);
    return isRowCompleted(page, 1);
  }, 15_000);

  await check(report, '3d. Completed row shows green target text', async () => {
    return page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      const greenDiv = row?.querySelector('.text-green-400');
      return greenDiv !== null && (greenDiv?.textContent?.length ?? 0) > 0;
    }, 1);
  });

  await check(report, '3i. Focus shifts to sr-only input on completion', async () => {
    const sr = page.locator('[aria-label="Press Enter to continue"]');
    await sr.waitFor({ state: 'attached', timeout: 2_000 });
    return true;
  });

  await check(report, '3b. Enter advances to next sentence', async () => {
    await pressEnter(page);
    await waitForActive(page, 2, 4_000);
    return true;
  }, 6_000);

  await check(report, '3c. Enter on incomplete does nothing', async () => {
    await activateClean(page, 2);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('she li', { delay: CHAR_DELAY_MS });
    await ta.press('Enter');
    await sleep(200);
    return page.evaluate((i: number) =>
      document.querySelector(`[data-index="${i}"]`)?.className.includes('emerald') ?? false, 2);
  }, 8_000);

  await check(report, '3f. Completion via corrections triggers', async () => {
    await activateClean(page, 2);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('zzz', { delay: CHAR_DELAY_MS });
    for (let j = 0; j < 3; j++) await ta.press('Backspace');
    await sleep(80);
    await completeTyping(page, 2);
    return isRowCompleted(page, 2);
  }, 25_000);

  await pressEnter(page).catch(() => {});

  await check(report, '3g. Completion via Tab triggers', async () => {
    await activateClean(page, 3);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    const target = LESSON_SENTENCES[3];
    for (let j = 0; j < target.length; j++) {
      await ta.press('Tab');
      await sleep(50);
    }
    return isRowCompleted(page, 3);
  }, 20_000);

  await pressEnter(page).catch(() => {});

  await check(report, '3h. Completion with punctuation triggers', async () => {
    await activateClean(page, 4);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially("he drink's cold water", { delay: CHAR_DELAY_MS });
    return isRowCompleted(page, 4);
  }, 20_000);

  await pressEnter(page).catch(() => {});

  await check(report, '3e. Last sentence Enter parks at end', async () => {
    await activateClean(page, 9);
    await completeTyping(page, 9);
    await pressEnter(page);
    await sleep(300);
    const time = await getAudioTime(page);
    return time > SENTENCE_ENDS[9];
  }, 25_000);
}
