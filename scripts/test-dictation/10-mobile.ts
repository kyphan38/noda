/**
 * Group 10: Mobile Viewport — verify the app works on a phone-sized screen.
 *
 * Runs in a separate browser context with a 375×812 viewport (iPhone-class).
 * Tests: mode tabs visible, dictation input works, hint button, next button,
 * completion flow, and audio playback.
 */
import { chromium, Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, APP_URL, LESSON_SENTENCES, CHAR_DELAY_MS,
  SENTENCE_STARTS, SENTENCE_ENDS,
  seedLesson, seekToSentence, waitForActive, pauseAudio, pressEnter,
  isRowCompleted, countSpans, countStars, getAudioTime, dismissModal,
  clearInput, activateClean, completeTyping,
} from './helpers.js';

export async function run(_desktopPage: Page, report: ReportEntry[]) {
  console.log('\n─── 10. Mobile Viewport ───');

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

  // ── Setup ──────────────────────────────────────────────────────────────────
  await page.goto(APP_URL);

  await check(report, '10a. Mobile: app loads', async () => {
    await page.waitForSelector('[data-index="0"]', { timeout: 20_000 });
  }, 22_000);

  // Mode tabs should be visible on mobile now
  await check(report, '10b. Mobile: mode tabs visible', async () => {
    const tab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
    await tab.waitFor({ state: 'visible', timeout: 5_000 });
    return true;
  }, 7_000);

  await check(report, '10c. Mobile: switch to dictation', async () => {
    const tab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
    await tab.click();
    await sleep(300);
    const cur = page.locator('nav[aria-label="Lesson mode"] button[aria-current="page"]');
    return (await cur.textContent())?.trim() === 'Dictation';
  });

  // ── Mobile Input ───────────────────────────────────────────────────────────
  await check(report, '10d. Mobile: activate sentence + input visible', async () => {
    await activateClean(page, 0);
    const input = page.locator('[data-dictation-input]');
    await input.waitFor({ state: 'attached', timeout: 3_000 });
    return true;
  }, 6_000);

  await check(report, '10e. Mobile: typing shows green chars', async () => {
    const input = page.locator('[data-dictation-input]');
    await input.focus();
    await input.pressSequentially('the cat', { delay: CHAR_DELAY_MS });
    const green = await countSpans(page, 0, 'text-emerald-500');
    return green === 7;
  }, 10_000);

  // ── Hint button ────────────────────────────────────────────────────────────
  await check(report, '10f. Mobile: hint button fills next char', async () => {
    await activateClean(page, 0);
    const input = page.locator('[data-dictation-input]');
    await input.focus();
    await input.pressSequentially('the', { delay: CHAR_DELAY_MS });
    const greenBefore = await countSpans(page, 0, 'text-emerald-500');
    const hintBtn = page.locator('[data-dictation-hint]');
    await hintBtn.click();
    await sleep(200);
    const greenAfter = await countSpans(page, 0, 'text-emerald-500');
    return greenAfter > greenBefore;
  }, 10_000);

  // ── Full completion + Next button ──────────────────────────────────────────
  await check(report, '10g. Mobile: complete sentence', async () => {
    await activateClean(page, 0);
    await completeTyping(page, 0);
    return isRowCompleted(page, 0);
  }, 20_000);

  await check(report, '10h. Mobile: next button advances', async () => {
    const nextBtn = page.locator('[data-dictation-next]');
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
    } else {
      await pressEnter(page);
    }
    await waitForActive(page, 1, 4_000);
    return true;
  }, 6_000);

  // ── Audio boundaries still work on mobile ──────────────────────────────────
  await check(report, '10i. Mobile: audio pauses at sentence end', async () => {
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

  // ── Player controls accessible on mobile ───────────────────────────────────
  await check(report, '10j. Mobile: play button works', async () => {
    await pauseAudio(page);
    const playBtn = page.locator('button[aria-label="Play"]').first();
    await playBtn.waitFor({ state: 'visible', timeout: 3_000 });
    await playBtn.click();
    await sleep(300);
    const paused = await page.evaluate(() => {
      const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
      return m?.paused ?? true;
    });
    return !paused;
  });

  await pauseAudio(page);

  // ── Backspace works on mobile ──────────────────────────────────────────────
  await check(report, '10k. Mobile: backspace removes char', async () => {
    await activateClean(page, 1);
    const input = page.locator('[data-dictation-input]');
    await input.focus();
    await input.pressSequentially('a do', { delay: CHAR_DELAY_MS });
    const greenBefore = await countSpans(page, 1, 'text-emerald-500');
    await input.press('Backspace');
    await sleep(100);
    const greenAfter = await countSpans(page, 1, 'text-emerald-500');
    return greenBefore === 4 && greenAfter === 3;
  });

  // ── Scroll to lower sentences works ────────────────────────────────────────
  await check(report, '10l. Mobile: can navigate to later sentences', async () => {
    await activateClean(page, 8);
    const green = await countStars(page, 8);
    return green > 0;
  }, 6_000);

  await browser.close();
}
