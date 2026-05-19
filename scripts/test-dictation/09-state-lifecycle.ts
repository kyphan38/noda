/**
 * Group 9: State Lifecycle — retry, reset progress, mode switch.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep,
  activateClean, completeTyping, pressEnter, isRowCompleted,
  seekToSentence, waitForActive, pauseAudio, getAudioTime, isAudioPaused,
  dismissModal,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 9. State Lifecycle ───');
  await dismissModal(page);

  await check(report, '9a. Retry clears completion', async () => {
    await seekToSentence(page, 9);
    await waitForActive(page, 9, 4_000);
    await sleep(200);
    const retryBtn = page.locator(`[data-index="9"] button[title="Practice this sentence again"]`);
    if (await retryBtn.count() === 0) return false;
    await retryBtn.click();
    await sleep(300);
    const completed = await isRowCompleted(page, 9);
    return !completed;
  }, 6_000);

  await check(report, '9b. Retry allows re-typing', async () => {
    await activateClean(page, 9);
    await completeTyping(page, 9);
    return isRowCompleted(page, 9);
  }, 25_000);

  await dismissModal(page);

  await check(report, '9c. Reset clears all progress', async () => {
    const resetBtn = page.locator('button[aria-label="Reset dictation progress"]');
    if (await resetBtn.count() === 0) return false;
    await resetBtn.click();
    await sleep(500);
    const c0 = await isRowCompleted(page, 0);
    const c1 = await isRowCompleted(page, 1);
    const c2 = await isRowCompleted(page, 2);
    return !c0 && !c1 && !c2;
  }, 4_000);

  await dismissModal(page);
  await check(report, '9d. Mode switch to Normal resets audio', async () => {
    await seekToSentence(page, 5);
    await sleep(300);
    const normalTab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Normal' });
    await normalTab.click();
    await sleep(500);
    const time = await getAudioTime(page);
    const paused = await isAudioPaused(page);
    return paused && time < 0.5;
  }, 6_000);

  await dismissModal(page);
  await check(report, '9e. Mode switch back preserves progress', async () => {
    const dictTab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
    await dictTab.click();
    await sleep(300);
    await dismissModal(page);
    await activateClean(page, 0);
    await completeTyping(page, 0);
    await pressEnter(page).catch(() => {});
    await dismissModal(page);
    const normalTab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Normal' });
    await normalTab.click();
    await sleep(300);
    await dictTab.click();
    await sleep(300);
    await dismissModal(page);
    return isRowCompleted(page, 0);
  }, 20_000);

  await dismissModal(page);
  await check(report, '9f. All sentences completed count', async () => {
    for (let i = 1; i <= 9; i++) {
      const done = await isRowCompleted(page, i);
      if (!done) {
        await activateClean(page, i);
        await completeTyping(page, i);
        await pressEnter(page).catch(() => {});
      }
    }
    let allDone = true;
    for (let i = 0; i < 10; i++) {
      if (!(await isRowCompleted(page, i))) { allDone = false; break; }
    }
    return allDone;
  }, 120_000);
}
