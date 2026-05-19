/**
 * Group 7: Audio Start Accuracy — no background audio, correct start position.
 * Uses sentences 3, 4, 8, 9.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep,
  SENTENCE_STARTS, SENTENCE_ENDS,
  activateClean, completeTyping, pressEnter, isRowCompleted,
  seekToSentence, pauseAudio, playAudio, setAudioTime, getAudioTime,
  dismissModal, waitForActive,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 7. Audio Start Accuracy ───');

  await check(report, '7a. Seek → currentTime at sentence.start', async () => {
    await seekToSentence(page, 3);
    await sleep(200);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[3]) < 0.3;
  });

  await pauseAudio(page);

  await check(report, '7b. Enter → currentTime at next start', async () => {
    await activateClean(page, 8);
    const completed = await isRowCompleted(page, 8);
    if (!completed) {
      await completeTyping(page, 8);
    }
    await pressEnter(page);
    await sleep(300);
    await dismissModal(page);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[9]) < 0.5;
  }, 20_000);

  await dismissModal(page);
  await pauseAudio(page);

  await dismissModal(page);
  await check(report, '7c. Ctrl → currentTime at sentence.start', async () => {
    await activateClean(page, 3);
    const ta = page.locator('[data-dictation-input]');
    if (await ta.count() > 0) {
      await ta.focus();
    } else {
      const sr = page.locator('[aria-label="Press Enter to continue"]');
      await sr.waitFor({ state: 'attached', timeout: 2_000 });
    }
    await setAudioTime(page, SENTENCE_STARTS[3] + 0.5);
    await sleep(80);
    await page.keyboard.press('Control');
    await sleep(300);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[3]) < 0.3;
  });

  await pauseAudio(page);

  await dismissModal(page);
  await check(report, '7d. Click row → currentTime at start', async () => {
    const row = page.locator(`[data-index="4"]`);
    await row.waitFor({ state: 'visible', timeout: 3_000 });
    await row.click();
    await sleep(300);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[4]) < 0.5;
  });

  await pauseAudio(page);

  await dismissModal(page);
  await check(report, '7e. Play resume rewinds from near-end', async () => {
    await activateClean(page, 3);
    await setAudioTime(page, SENTENCE_ENDS[3] - 0.02);
    await pauseAudio(page);
    await sleep(100);
    const playBtn = page.locator('button[aria-label="Play"], button[aria-label="Pause"]').first();
    await playBtn.click();
    await sleep(400);
    const time = await getAudioTime(page);
    return time <= SENTENCE_STARTS[3] + 0.8;
  }, 6_000);

  await pauseAudio(page);

  await check(report, '7i. Audio stays within sentence bounds during play', async () => {
    await seekToSentence(page, 3);
    await sleep(100);
    const start = SENTENCE_STARTS[3];
    let minTime = Infinity;
    for (let j = 0; j < 15; j++) {
      const t = await getAudioTime(page);
      if (t < minTime) minTime = t;
      await sleep(100);
    }
    return minTime >= start - 0.1;
  }, 4_000);

  await pauseAudio(page);

  await check(report, '7j. Audio stops within sentence boundary', async () => {
    await seekToSentence(page, 3);
    return page.waitForFunction(
      ([end]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && m.currentTime >= end - 0.15 && m.currentTime <= end + 0.05;
      },
      [SENTENCE_ENDS[3]] as [number],
      { timeout: 3_000 }
    ).then(() => true);
  }, 4_000);

  await check(report, '7k. Resume from gap jumps to next sentence', async () => {
    await setAudioTime(page, 7.0);
    await playAudio(page);
    return page.waitForFunction(
      ([start]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && Math.abs(m.currentTime - start) < 0.5;
      },
      [SENTENCE_STARTS[4]] as [number],
      { timeout: 4_000 }
    ).then(() => true);
  }, 5_000);
}
