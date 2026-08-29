/**
 * Group 17: Word Wrap - no word split across lines, correct vertical alignment.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry,
  check,
  dismissModal,
  activateClean,
  typeAnswer,
  sleep,
  CHAR_DELAY_MS,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 17. Word Wrap ───');
  await dismissModal(page);

  // Use sentence 9: "rain falls from the clouds" (26 chars) - wraps at narrow widths
  const idx = 9;

  await check(report, '17a. No word split across two lines (narrow viewport)', async () => {
    await page.setViewportSize({ width: 480, height: 900 });
    await activateClean(page, idx);
    // Type a few chars so we have a mix of colored spans
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('rainfallsfromthe', { delay: CHAR_DELAY_MS });
    await sleep(200);

    // Check that every nowrap span has all its characters on the same line (same offsetTop)
    const allOnSameLine = await page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      const wordSpans = row.querySelectorAll('span.whitespace-nowrap');
      if (wordSpans.length === 0) return false;
      for (const ws of wordSpans) {
        const chars = ws.querySelectorAll('span');
        if (chars.length === 0) continue;
        const tops = new Set<number>();
        for (const ch of chars) {
          tops.add(Math.round(ch.getBoundingClientRect().top));
        }
        // All characters in a word must share the same top → single value in set
        if (tops.size > 1) return false;
      }
      return true;
    }, idx);

    await page.setViewportSize({ width: 1280, height: 900 });
    return allOnSameLine;
  }, 20_000);

  await check(report, '17b. Incorrect and correct chars aligned on same baseline', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await activateClean(page, idx);
    // Type a mix of correct and incorrect chars: "rxin" → maps to "r(x)in" where x is wrong
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('rxin', { delay: CHAR_DELAY_MS });
    await sleep(200);

    const aligned = await page.evaluate((i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      const greenSpans = row.querySelectorAll('span.text-emerald-500');
      const redSpans = row.querySelectorAll('span.text-red-500');
      if (greenSpans.length === 0 || redSpans.length === 0) return false;

      // Collect bounding-rect tops for first-line green and red chars
      const greenTops = [...greenSpans].map(s => Math.round(s.getBoundingClientRect().top));
      const redTops = [...redSpans].map(s => Math.round(s.getBoundingClientRect().top));

      // All first-line chars (green and red) should share the same top (within 1px tolerance)
      const firstLineTop = greenTops[0];
      const allGreenOk = greenTops.filter(t => t === firstLineTop).length > 0;
      const allRedOk = redTops.every(t => Math.abs(t - firstLineTop) <= 1);
      return allGreenOk && allRedOk;
    }, idx);

    return aligned;
  }, 15_000);
}
