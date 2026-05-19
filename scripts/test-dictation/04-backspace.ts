/**
 * Group 4: Backspace Contract — wrong chars, overflow, invisible chars.
 * Uses sentence 5 ("birds sing in the morning", 25 chars).
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, LESSON_SENTENCES, CHAR_DELAY_MS,
  activateClean, completeTyping, pressEnter, countSpans, countStars,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 4. Backspace Contract ───');
  const bsIdx = 5;

  await check(report, '4-setup. Activate sentence 6', async () => {
    await activateClean(page, bsIdx);
  }, 6_000);

  await check(report, '4c. Backspace on empty is no-op', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.press('Backspace');
    await sleep(100);
    const stars = await countStars(page, bsIdx);
    return stars > 0;
  });

  await check(report, '4a. Backspace removes last visible char', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.pressSequentially('bird', { delay: CHAR_DELAY_MS });
    const greenBefore = await countSpans(page, bsIdx, 'text-emerald-500');
    await ta.press('Backspace');
    await sleep(100);
    const greenAfter = await countSpans(page, bsIdx, 'text-emerald-500');
    return greenBefore === 4 && greenAfter === 3;
  });

  { const ta = page.locator('[data-dictation-input]'); for (let j = 0; j < 3; j++) await ta.press('Backspace'); await sleep(100); }

  await check(report, '4b. Backspace on wrong char removes it', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.pressSequentially('bx', { delay: CHAR_DELAY_MS });
    const redBefore = await countSpans(page, bsIdx, 'text-red-500');
    await ta.press('Backspace');
    await sleep(100);
    const redAfter = await countSpans(page, bsIdx, 'text-red-500');
    return redBefore === 1 && redAfter === 0;
  });

  { const ta = page.locator('[data-dictation-input]'); await ta.press('Backspace'); await sleep(100); }

  await check(report, '4d. Overflow typing is clamped', async () => {
    await activateClean(page, bsIdx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    const targetLen = LESSON_SENTENCES[bsIdx].length;
    const prefix = LESSON_SENTENCES[bsIdx].slice(0, targetLen - 2);
    await ta.pressSequentially(prefix + 'xxxx', { delay: CHAR_DELAY_MS });
    const totalChars = await page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return 0;
      const green = row.querySelectorAll('span.text-emerald-500').length;
      const red = row.querySelectorAll('span.text-red-500').length;
      return green + red;
    }, bsIdx);
    return totalChars === targetLen;
  }, 25_000);

  await check(report, '4e. Backspace after overflow removes visible char', async () => {
    await activateClean(page, bsIdx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    const targetLen = LESSON_SENTENCES[bsIdx].length;
    const prefix = LESSON_SENTENCES[bsIdx].slice(0, targetLen - 2);
    await ta.pressSequentially(prefix + 'xxx', { delay: CHAR_DELAY_MS });
    const redBefore = await countSpans(page, bsIdx, 'text-red-500');
    await ta.press('Backspace');
    await sleep(150);
    const redAfter = await countSpans(page, bsIdx, 'text-red-500');
    return redBefore >= 2 && redAfter < redBefore;
  }, 25_000);

  await activateClean(page, bsIdx);

  await check(report, '4f. Backspace after punctuation removes visible char', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('bi.r', { delay: CHAR_DELAY_MS });
    const greenBefore = await countSpans(page, bsIdx, 'text-emerald-500');
    await ta.press('Backspace');
    await sleep(150);
    const greenAfter = await countSpans(page, bsIdx, 'text-emerald-500');
    return greenBefore === 3 && greenAfter === 2;
  });

  await activateClean(page, bsIdx);

  await check(report, '4g. Multiple backspaces to empty', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('birds', { delay: CHAR_DELAY_MS });
    for (let j = 0; j < 5; j++) await ta.press('Backspace');
    await sleep(100);
    const green = await countSpans(page, bsIdx, 'text-emerald-500');
    const red = await countSpans(page, bsIdx, 'text-red-500');
    const stars = await countStars(page, bsIdx);
    return green === 0 && red === 0 && stars > 0;
  });

  await activateClean(page, bsIdx);
  await completeTyping(page, bsIdx);
  await pressEnter(page).catch(() => {});
}
