/**
 * Group 13: Mobile Audio Sync — timeline ↔ active sentence alignment.
 *
 * Regression guard for: on mobile, seeking from a gap (e.g. before the first
 * sentence) causes the RAF playback loop to read stale currentTime during the
 * async seek, triggering conflicting re-seeks that leave the displayed time
 * and active sentence out of sync.
 *
 * Runs in a mobile (iPhone) viewport with touch context.
 */
import { chromium, Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, APP_URL, LESSON_SENTENCES,
  SENTENCE_STARTS, SENTENCE_ENDS,
  seedLesson, seekToSentence, waitForActive, pauseAudio, playAudio,
  setAudioTime, getAudioTime, isAudioPaused, dismissModal,
  activateClean, completeTyping, pressEnter,
} from './helpers.js';

export async function run(_desktopPage: Page, report: ReportEntry[]) {
  console.log('\n─── 13. Mobile Audio Sync ───');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await seedLesson(context);
  const page = await context.newPage();

  await page.goto(APP_URL);
  await page.waitForSelector('[data-index="0"]', { timeout: 20_000 });

  // Switch to dictation mode
  const dictTab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
  await dictTab.click();
  await sleep(300);

  // ── 13a. Seek to sentence activates correct sentence on mobile ─────────────
  await check(report, '13a. Mobile: seek activates correct sentence', async () => {
    await seekToSentence(page, 2);
    await waitForActive(page, 2, 4_000);
    return true;
  }, 6_000);

  await pauseAudio(page);

  // ── 13b. Displayed time matches active sentence range ──────────────────────
  await check(report, '13b. Mobile: displayed time within active sentence range', async () => {
    await seekToSentence(page, 3);
    await waitForActive(page, 3, 4_000);
    await sleep(200);
    const time = await getAudioTime(page);
    return time >= SENTENCE_STARTS[3] - 0.3 && time < SENTENCE_ENDS[3] + 0.1;
  }, 6_000);

  await pauseAudio(page);

  // ── 13c. Play from gap seeks to next sentence ──────────────────────────────
  await check(report, '13c. Mobile: play from gap parks at next sentence', async () => {
    // Set audio to a gap between sentences
    await setAudioTime(page, 1.5);
    await sleep(100);
    await playAudio(page);
    // Should detect the gap and seek to sentence 1's start (1.8)
    return page.waitForFunction(
      ([start]: [number]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.paused && Math.abs(m.currentTime - start) < 0.5;
      },
      [SENTENCE_STARTS[1]] as [number],
      { timeout: 4_000 },
    ).then(() => true);
  }, 6_000);

  // ── 13d. After gap-seek, active sentence matches audio position ────────────
  await check(report, '13d. Mobile: active sentence matches after gap seek', async () => {
    const time = await getAudioTime(page);
    // The active sentence should be the one whose range contains the current time
    return page.evaluate(
      ([t, starts, ends]: [number, number[], number[]]) => {
        for (let i = 0; i < starts.length; i++) {
          if (t >= starts[i] - 0.3 && t < ends[i] + 0.1) {
            const row = document.querySelector(`[data-index="${i}"]`);
            return row?.className.includes('emerald') ?? false;
          }
        }
        return false;
      },
      [time, SENTENCE_STARTS, SENTENCE_ENDS] as [number, number[], number[]],
    );
  }, 4_000);

  // ── 13e. Click sentence row → time and active line agree ───────────────────
  await check(report, '13e. Mobile: click row syncs time and highlight', async () => {
    const row = page.locator('[data-index="4"]');
    await row.click();
    await waitForActive(page, 4, 4_000);
    await sleep(300);
    const time = await getAudioTime(page);
    return time >= SENTENCE_STARTS[4] - 0.3 && time < SENTENCE_ENDS[4] + 0.1;
  }, 6_000);

  await pauseAudio(page);

  // ── 13f. Ctrl replay keeps time and active line in sync ────────────────────
  await check(report, '13f. Mobile: replay (Ctrl) keeps time synced', async () => {
    await activateClean(page, 5);
    const input = page.locator('[data-dictation-input]');
    if (await input.count() > 0) {
      await input.focus();
    }
    // Advance time partway into the sentence
    await setAudioTime(page, SENTENCE_STARTS[5] + 0.5);
    await sleep(100);
    // Press Ctrl to replay (simulate via keyboard)
    await page.keyboard.press('Control');
    await sleep(400);
    const time = await getAudioTime(page);
    // Time should be back near sentence start
    return Math.abs(time - SENTENCE_STARTS[5]) < 0.5;
  }, 6_000);

  await pauseAudio(page);

  // ── 13g. Enter advance → next sentence time is correct ─────────────────────
  await check(report, '13g. Mobile: Enter advance sets correct time', async () => {
    await activateClean(page, 0);
    await completeTyping(page, 0);
    await pressEnter(page);
    await sleep(400);
    const time = await getAudioTime(page);
    return Math.abs(time - SENTENCE_STARTS[1]) < 0.5;
  }, 20_000);

  // ── 13h. Timeline slider value matches active sentence ─────────────────────
  await check(report, '13h. Mobile: slider value matches active sentence', async () => {
    await seekToSentence(page, 6);
    await waitForActive(page, 6, 4_000);
    await sleep(200);
    // Read the slider value and the audio time — they should agree
    const [sliderVal, audioTime] = await page.evaluate(() => {
      const slider = document.querySelector('input[aria-label="Seek"]') as HTMLInputElement | null;
      const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
      return [parseFloat(slider?.value ?? '0'), m?.currentTime ?? -1];
    });
    return Math.abs(sliderVal - audioTime) < 1.0;
  }, 6_000);

  await browser.close();
}
