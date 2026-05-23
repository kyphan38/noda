/**
 * Group 16: Dictation UI — rewrite icon layout, auto-scroll, continue affordance.
 */
import { Page } from '@playwright/test';
import {
  ReportEntry,
  check,
  dismissModal,
  activateClean,
  completeTyping,
  seekToSentence,
  waitForActive,
  isRowVisible,
  isRowCompleted,
  scrollTranscriptToTop,
  rewriteSlotWidth,
  getRewriteStatusCenterDeltaY,
} from './helpers.js';

export async function run(page: Page, report: ReportEntry[]) {
  console.log('\n─── 16. Dictation UI ───');
  await dismissModal(page);

  const idx = 1;

  await check(report, '16a. Rewrite slot reserved before completion', async () => {
    await activateClean(page, idx);
    const width = await rewriteSlotWidth(page, idx);
    const rewriteCount = await page.locator(`[data-index="${idx}"] [data-dictation-rewrite]`).count();
    return width >= 40 && rewriteCount === 0;
  }, 8_000);

  await check(report, '16b. Rewrite line button visible after completion', async () => {
    await completeTyping(page, idx);
    const btn = page.locator(`[data-index="${idx}"] button[title="Rewrite line"]`);
    return (await btn.count()) > 0 && (await btn.isVisible());
  }, 15_000);

  await check(report, '16c. Rewrite aligned with status icon (single line)', async () => {
    const delta = await getRewriteStatusCenterDeltaY(page, idx);
    return delta !== null && delta < 2;
  });

  await check(report, '16d. Rewrite aligned when text wraps (narrow viewport)', async () => {
    const wrapIdx = 9;
    await page.setViewportSize({ width: 480, height: 900 });
    await activateClean(page, wrapIdx);
    await completeTyping(page, wrapIdx);
    const delta = await getRewriteStatusCenterDeltaY(page, wrapIdx);
    await page.setViewportSize({ width: 1280, height: 900 });
    return delta !== null && delta < 2;
  }, 20_000);

  await check(report, '16e. Active row scrolls into view after seek', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await scrollTranscriptToTop(page);
    await seekToSentence(page, 8);
    await waitForActive(page, 8, 4_000);
    return isRowVisible(page, 8);
  }, 8_000);

  await check(report, '16f. Continue prompt attached and row visible after completion', async () => {
    const completeIdx = 3;
    await activateClean(page, completeIdx);
    await scrollTranscriptToTop(page);
    await completeTyping(page, completeIdx);
    const sr = page.locator('[aria-label="Press Enter to continue"]');
    await sr.waitFor({ state: 'attached', timeout: 2_000 });
    const completed = await isRowCompleted(page, completeIdx);
    const visible = await isRowVisible(page, completeIdx);
    return completed && visible;
  }, 20_000);
}
