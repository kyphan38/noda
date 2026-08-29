/**
 * Group 2: Input Contract - typing, display, normalization.
 * Uses sentence 0 ("the cat sat on the mat", 22 chars).
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, LESSON_SENTENCES, CHAR_DELAY_MS,
  activateClean, typeAnswer, countSpans, countStars, isRowCompleted, pressEnter,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 2. Input Contract ───');
  const idx = 0;
  const target = LESSON_SENTENCES[idx];

  await check(report, '2-setup. Activate sentence 1', async () => {
    await activateClean(page, idx);
  }, 6_000);

  await check(report, '2c. Untyped chars show gray stars', async () => {
    const stars = await countStars(page, idx);
    return stars === 17;
  });

  await check(report, '2a. Correct char shows green', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('t', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    return green === 1 && red === 0;
  });

  { const ta = page.locator('[data-dictation-input]'); await ta.press('Backspace'); await sleep(100); }

  await check(report, '2b. Wrong char shows red', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.pressSequentially('z', { delay: CHAR_DELAY_MS });
    const red = await countSpans(page, idx, 'text-red-500');
    return red === 1;
  });

  { const ta = page.locator('[data-dictation-input]'); await ta.press('Backspace'); await sleep(100); }

  await check(report, '2d. Blinking cursor at typing position', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.pressSequentially('th', { delay: CHAR_DELAY_MS });
    return page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      const cursor = row.querySelector('.animate-pulse');
      if (!cursor) return false;
      const spans = row.querySelectorAll('span');
      const cursorIdx = [...spans].indexOf(cursor as HTMLSpanElement);
      return cursorIdx >= 0;
    }, idx);
  });

  { const ta = page.locator('[data-dictation-input]'); await ta.press('Backspace'); await ta.press('Backspace'); await sleep(100); }

  await check(report, '2e. Spaces auto-inserted from target layout', async () => {
    const ta = page.locator('[data-dictation-input]');
    // Type "thec" - letters map to "the c" (auto-space at position 3)
    await ta.pressSequentially('thec', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    return green === 5; // t,h,e,(space),c
  });

  { const ta = page.locator('[data-dictation-input]'); for (let j = 0; j < 5; j++) await ta.press('Backspace'); await sleep(100); }

  await check(report, '2f. Punctuation is stripped silently', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('the.', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    return green === 3 && red === 0;
  });

  { const ta = page.locator('[data-dictation-input]'); for (let j = 0; j < 3; j++) await ta.press('Backspace'); await sleep(100); }

  await check(report, '2g. Case is ignored', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('THECAT', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    return green === 7 && red === 0; // "the cat" with auto-space
  });

  { const ta = page.locator('[data-dictation-input]'); for (let j = 0; j < 7; j++) await ta.press('Backspace'); await sleep(100); }

  await check(report, '2h. Double spaces collapse', async () => {
    await activateClean(page, idx);
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('the  cat', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    return green === 7 && red === 0; // spaces stripped, letters aligned
  });

  { const ta = page.locator('[data-dictation-input]'); for (let j = 0; j < 7; j++) await ta.press('Backspace'); await sleep(100); }

  await check(report, '2i. Full correct answer shows all green', async () => {
    await activateClean(page, idx);
    await typeAnswer(page, target);
    const green = await countSpans(page, idx, 'text-emerald-500');
    const red = await countSpans(page, idx, 'text-red-500');
    const stars = await countStars(page, idx);
    if (green === 0 && red === 0 && stars === 0) {
      return await isRowCompleted(page, idx);
    }
    return green > 0 && red === 0 && stars === 0;
  }, 15_000);

  await pressEnter(page).catch(() => {});
}
