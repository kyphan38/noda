/**
 * Group 14: Player Popovers - speed slider & repeat count selector.
 *
 * Tests:
 * - Speed popover opens on click, slider changes playback rate, closes on outside click
 * - Repeat popover opens on click, selecting 1/2/3 changes repeat count, closes on outside click
 * - Only one popover open at a time
 * - Mobile: both popovers work on small viewport
 */
import { chromium, Page } from '@playwright/test';
import {
  ReportEntry, check, sleep, APP_URL,
  seedLesson, seekToSentence, waitForActive, pauseAudio,
} from './helpers.js';

async function setupDictation(page: Page) {
  const tab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
  await tab.waitFor({ state: 'visible', timeout: 5_000 });
  await tab.click();
  await sleep(300);
}

function closeByClickingPlay(page: Page) {
  return (async () => {
    await page.locator('button[aria-label="Play"]').first().click({ force: true });
    await sleep(200);
    await pauseAudio(page);
  })();
}

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 14. Player Popovers ───');

  await page.goto(APP_URL);
  await page.waitForSelector('[data-index="0"]', { timeout: 20_000 });
  await setupDictation(page);
  await seekToSentence(page, 0);
  await waitForActive(page, 0, 4_000);
  await pauseAudio(page);

  const repeatTrigger = () => page.locator('button[data-repeat-trigger]');
  const speedTrigger = () => page.locator('button[aria-label^="Playback speed"]');
  const repeatOption = (n: number | 'infinite') => page.locator(`button[data-repeat-option="${n}"]`);
  const speedSlider = () => page.locator('input[aria-label="Playback speed"]');

  // ── Speed Popover ─────────────────────────────────────────────────────────

  await check(report, '14a. Speed button visible', async () => {
    await speedTrigger().waitFor({ state: 'visible', timeout: 3_000 });
    return true;
  });

  await check(report, '14b. Speed popover opens on click', async () => {
    await speedTrigger().click();
    await sleep(200);
    return (await speedSlider().count()) === 1;
  });

  await check(report, '14c. Speed slider changes playback rate', async () => {
    await speedSlider().fill('0.5');
    await speedSlider().dispatchEvent('input');
    await sleep(200);
    const rate = await page.evaluate(() => {
      const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
      return m?.playbackRate ?? -1;
    });
    return Math.abs(rate - 0.5) < 0.05;
  });

  await check(report, '14d. Speed popover shows current value label', async () => {
    const label = speedSlider().locator('..').locator('span').first();
    const text = await label.textContent();
    return text?.includes('0.5') ?? false;
  });

  await check(report, '14e. Speed popover closes on outside click', async () => {
    await closeByClickingPlay(page);
    return (await speedSlider().count()) === 0;
  });

  // ── Repeat Popover ────────────────────────────────────────────────────────

  await check(report, '14f. Repeat button visible', async () => {
    await repeatTrigger().waitFor({ state: 'visible', timeout: 3_000 });
    return true;
  });

  await check(report, '14g. Repeat popover opens on click', async () => {
    await repeatTrigger().click();
    await sleep(200);
    return (await repeatOption(2).count()) === 1;
  });

  await check(report, '14h. Repeat popover has 4 options (1, 2, 3, infinite)', async () => {
    return (
      (await repeatOption(1).count()) === 1 &&
      (await repeatOption(2).count()) === 1 &&
      (await repeatOption(3).count()) === 1 &&
      (await repeatOption('infinite').count()) === 1
    );
  });

  await check(report, '14i. Selecting repeat count closes popover & updates button', async () => {
    await repeatOption(2).click();
    await sleep(200);
    const closed = (await repeatOption(3).count()) === 0;
    const btnLabel = await repeatTrigger().getAttribute('aria-label');
    return closed && btnLabel === 'Repeat 2 times';
  });

  await check(report, '14j. Trigger button green when count > 1', async () => {
    const classes = await repeatTrigger().getAttribute('class');
    return classes?.includes('text-green-400') ?? false;
  });

  await check(report, '14k. Repeat popover re-opens and shows selected value', async () => {
    await repeatTrigger().click();
    await sleep(200);
    const classes = await repeatOption(2).getAttribute('class');
    const isSelected = classes?.includes('bg-green-600') ?? false;
    await closeByClickingPlay(page);
    return isSelected;
  });

  // ── Mutual exclusion ──────────────────────────────────────────────────────

  await check(report, '14l. Opening speed closes repeat popover', async () => {
    await repeatTrigger().click();
    await sleep(200);
    const repeatOpenBefore = (await repeatOption(1).count()) === 1;

    await speedTrigger().click();
    await sleep(200);

    const speedOpen = (await speedSlider().count()) === 1;
    const repeatClosed = (await repeatOption(1).count()) === 0;

    await closeByClickingPlay(page);
    return repeatOpenBefore && speedOpen && repeatClosed;
  });

  await check(report, '14m. Opening repeat closes speed popover', async () => {
    await speedTrigger().click();
    await sleep(200);
    const speedOpenBefore = (await speedSlider().count()) === 1;

    await repeatTrigger().click();
    await sleep(200);

    const repeatOpen = (await repeatOption(1).count()) === 1;
    const speedClosed = (await speedSlider().count()) === 0;

    await closeByClickingPlay(page);
    return speedOpenBefore && repeatOpen && speedClosed;
  });

  // Reset repeat count to 1
  await check(report, '14n. Reset: set repeat back to 1', async () => {
    await repeatTrigger().click();
    await sleep(200);
    await repeatOption(1).click();
    await sleep(200);
    const label = await repeatTrigger().getAttribute('aria-label');
    return label === 'Repeat 1 time';
  });

  // Reset speed to 1.0
  await check(report, '14o. Reset: set speed back to 1.0', async () => {
    await speedTrigger().click();
    await sleep(200);
    await speedSlider().fill('1');
    await speedSlider().dispatchEvent('input');
    await sleep(200);
    await closeByClickingPlay(page);
    return true;
  });

  // ── Mobile Popovers ───────────────────────────────────────────────────────

  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileCtx = await mobileBrowser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await seedLesson(mobileCtx);
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto(APP_URL);
  await mobilePage.waitForSelector('[data-index="0"]', { timeout: 20_000 });
  await setupDictation(mobilePage);
  await seekToSentence(mobilePage, 0);
  await waitForActive(mobilePage, 0, 4_000);
  await pauseAudio(mobilePage);

  const mRepeatTrigger = () => mobilePage.locator('button[data-repeat-trigger]');
  const mSpeedTrigger = () => mobilePage.locator('button[aria-label^="Playback speed"]');
  const mRepeatOption = (n: number | 'infinite') =>
    mobilePage.locator(`button[data-repeat-option="${n}"]`);
  const mSpeedSlider = () => mobilePage.locator('input[aria-label="Playback speed"]');

  await check(report, '14p. Mobile: speed popover opens', async () => {
    await mSpeedTrigger().tap();
    await sleep(300);
    const open = (await mSpeedSlider().count()) === 1;
    await mobilePage.locator('button[aria-label="Play"]').first().tap({ force: true });
    await sleep(200);
    await pauseAudio(mobilePage);
    return open;
  });

  await check(report, '14q. Mobile: repeat popover opens', async () => {
    await mRepeatTrigger().tap();
    await sleep(300);
    const open = (await mRepeatOption(1).count()) === 1;
    if (open) await mRepeatOption(1).tap();
    await sleep(200);
    return open;
  });

  await check(report, '14r. Mobile: selecting repeat count works', async () => {
    await mRepeatTrigger().tap();
    await sleep(300);
    await mRepeatOption(3).tap();
    await sleep(200);
    const label = await mRepeatTrigger().getAttribute('aria-label');
    const updated = label === 'Repeat 3 times';
    // Reset
    await mRepeatTrigger().tap();
    await sleep(300);
    if (await mRepeatOption(1).count()) await mRepeatOption(1).tap();
    await sleep(200);
    return updated;
  });

  await mobileBrowser.close();
}
