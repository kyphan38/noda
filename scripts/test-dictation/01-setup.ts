/**
 * Group 1: Setup — auth bypass, mode switch to Dictation.
 */
import { Page } from '@playwright/test';
import { ReportEntry, check, sleep, APP_URL } from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('─── 1. Setup ───');
  await page.goto(APP_URL);

  await check(report, '1a. App bypasses auth screen', async () => {
    await page.waitForSelector('[data-index="0"]', { timeout: 20_000 });
  }, 22_000);

  await check(report, '1b. Dictation tab visible + click', async () => {
    const tab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
    await tab.waitFor({ state: 'visible', timeout: 5_000 });
    await tab.click();
    await sleep(300);
  }, 7_000);

  await check(report, '1c. Dictation tab is active (aria-current)', async () => {
    const cur = page.locator('nav[aria-label="Lesson mode"] button[aria-current="page"]');
    return (await cur.textContent())?.trim() === 'Dictation';
  });
}
