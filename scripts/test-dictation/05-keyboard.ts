/**
 * Group 5: Keyboard Shortcuts — Tab hint, Ctrl replay, Enter on incomplete.
 * Uses sentence 6 ("the sky is very blue", 20 chars).
 */
import { Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, LESSON_SENTENCES, CHAR_DELAY_MS,
  clickRewriteLine,
  SENTENCE_STARTS, SENTENCE_ENDS,
  activateClean, completeTyping, pressEnter, countSpans,
  waitForActive, seekToSentence, pauseAudio, setAudioTime, isRowCompleted,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 5. Keyboard Shortcuts ───');
  const kbIdx = 6;

  await check(report, '5-setup. Activate sentence 7', async () => {
    await activateClean(page, kbIdx);
  }, 6_000);

  await check(report, '5a. Tab fills one correct char', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.press('Tab');
    await sleep(150);
    const green = await countSpans(page, kbIdx, 'text-emerald-500');
    return green === 1;
  });

  { const ta = page.locator('[data-dictation-input]'); await ta.press('Backspace'); await sleep(100); }

  await check(report, '5b. Tab fills after typed prefix', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.pressSequentially('the', { delay: CHAR_DELAY_MS });
    await ta.press('Tab');
    await sleep(150);
    const green = await countSpans(page, kbIdx, 'text-emerald-500');
    // Tab gives next letter 's', auto-space appears → "the s" = 5 greens
    return green === 5;
  });

  { const ta = page.locator('[data-dictation-input]'); for (let j = 0; j < 5; j++) await ta.press('Backspace'); await sleep(100); }

  await check(report, '5c. Tab after wrong prefix', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.pressSequentially('tx', { delay: CHAR_DELAY_MS });
    await ta.press('Tab');
    await sleep(150);
    const green = await countSpans(page, kbIdx, 'text-emerald-500');
    return green >= 1;
  });

  await activateClean(page, kbIdx);

  await check(report, '5d. Tab at full answer is no-op', async () => {
    await completeTyping(page, kbIdx);
    const completed = await isRowCompleted(page, kbIdx);
    if (!completed) return false;
    return true;
  }, 15_000);

  // Retry sentence 7 so we can test Ctrl/Enter on the textarea
  {
    await seekToSentence(page, kbIdx);
    await waitForActive(page, kbIdx, 4_000);
    await pauseAudio(page);
    await clickRewriteLine(page, kbIdx);
  }

  await check(report, '5e. Ctrl replays (seeks back)', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await setAudioTime(page, SENTENCE_STARTS[kbIdx] + 0.5);
    await sleep(80);
    await ta.press('Control');
    await page.waitForFunction(
      ([idx, starts]: [number, number[]]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.currentTime <= starts[idx] + 0.4;
      },
      [kbIdx, SENTENCE_STARTS] as [number, number[]],
      { timeout: 1_500 }
    );
    return true;
  });

  await check(report, '5f. Ctrl replay stops at sentence end', async () => {
    return page.waitForFunction(
      ([end]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && m.currentTime >= end - 0.15 && m.currentTime <= end + 0.05;
      },
      [SENTENCE_ENDS[kbIdx]] as [number],
      { timeout: 3_000 }
    ).then(() => true);
  }, 4_000);

  await activateClean(page, kbIdx);

  await check(report, '5g. Enter on incomplete is no-op', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('the sky', { delay: CHAR_DELAY_MS });
    await ta.press('Enter');
    await sleep(200);
    return page.evaluate((i: number) =>
      document.querySelector(`[data-index="${i}"]`)?.className.includes('emerald') ?? false, kbIdx);
  });

  await activateClean(page, kbIdx);
  await completeTyping(page, kbIdx);
  await pressEnter(page).catch(() => {});
}
