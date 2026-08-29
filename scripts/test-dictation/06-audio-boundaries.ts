/**
 * Group 6: Audio Boundaries - pause at end, gap parking, replay-once.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep,
  SENTENCE_STARTS, SENTENCE_ENDS,
  activateClean, completeTyping, pressEnter, waitForActive,
  setAudioTime, getAudioTime, playAudio, pauseAudio,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 6. Audio Boundaries ───');

  await check(report, '6a. Audio pauses at sentence end', async () => {
    const row = page.locator('[data-index="1"]');
    await row.click();
    await waitForActive(page, 1, 4_000);
    return page.waitForFunction(
      ([end]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && m.currentTime >= end - 0.15 && m.currentTime < end + 0.1;
      },
      [SENTENCE_ENDS[1]] as [number],
      { timeout: 4_000 }
    ).then(() => true);
  }, 6_000);

  await check(report, '6b. Audio in gap parks at next start', async () => {
    await setAudioTime(page, 1.5);
    await playAudio(page);
    return page.waitForFunction(
      ([start]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && Math.abs(m.currentTime - start) < 0.5;
      },
      [SENTENCE_STARTS[1]] as [number],
      { timeout: 4_000 }
    ).then(() => true);
  }, 5_000);

  await check(report, '6c. Resume after gap plays one sentence', async () => {
    await playAudio(page);
    return page.waitForFunction(
      ([end]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && m.currentTime >= end - 0.15 && m.currentTime < end + 0.1;
      },
      [SENTENCE_ENDS[1]] as [number],
      { timeout: 4_000 }
    ).then(() => true);
  }, 5_000);

  await check(report, '6d. No audio leak past sentence end', async () => {
    const time = await getAudioTime(page);
    return time < SENTENCE_ENDS[1] + 0.1;
  });

  await check(report, '6e. Completion does not auto-seek', async () => {
    await activateClean(page, 7);
    const timeBefore = await getAudioTime(page);
    await completeTyping(page, 7);
    const timeAfter = await getAudioTime(page);
    return Math.abs(timeAfter - timeBefore) < 1.0;
  }, 15_000);

  await check(report, '6f. Enter seeks to next sentence', async () => {
    await pressEnter(page);
    await sleep(300);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[8]) < 1.0;
  }, 6_000);
}
