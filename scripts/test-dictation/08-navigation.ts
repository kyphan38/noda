/**
 * Group 8: Navigation - click row seek, auto-scroll.
 * Uses sentences 7, 8, 0, 1.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep,
  SENTENCE_STARTS,
  seekToSentence, waitForActive, pauseAudio, getAudioTime,
  isRowCompleted, isRowVisible, dismissModal,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 8. Navigation ───');
  await dismissModal(page);

  await check(report, '8a. Seek activates correct sentence', async () => {
    await seekToSentence(page, 7);
    await waitForActive(page, 7, 4_000);
    return true;
  }, 6_000);

  await check(report, '8b. Click row seeks audio', async () => {
    const row = page.locator('[data-index="8"]');
    await row.waitFor({ state: 'visible', timeout: 3_000 });
    await row.click();
    await sleep(300);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[8]) < 2.5;
  });

  await check(report, '8c. Click row activates typing input', async () => {
    const completed = await isRowCompleted(page, 8);
    if (!completed) {
      const ta = page.locator('[data-dictation-input]');
      return (await ta.count()) > 0;
    }
    const sr = page.locator('[aria-label="Press Enter to continue"]');
    return (await sr.count()) > 0;
  });

  await check(report, '8d. Active sentence scrolled into view', async () => {
    await seekToSentence(page, 8);
    await waitForActive(page, 8, 4_000);
    return isRowVisible(page, 8);
  }, 6_000);

  await check(report, '8e. Clicking completed row seeks', async () => {
    const row = page.locator('[data-index="0"]');
    await row.click();
    await sleep(300);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[0]) < 2.5;
  });

  await check(report, '8f. Seeking backward activates earlier row', async () => {
    const row8 = page.locator('[data-index="8"]');
    await row8.click();
    await waitForActive(page, 8, 4_000);
    await pauseAudio(page);
    const row1 = page.locator('[data-index="1"]');
    await row1.click();
    await waitForActive(page, 1, 4_000);
    return true;
  }, 8_000);
}
