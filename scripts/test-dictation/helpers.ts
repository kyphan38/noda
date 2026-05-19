/**
 * Shared config, constants, helpers, and report system for dictation E2E tests.
 *
 * Each test group imports from here — no test logic lives in this file.
 */
import { Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────
export const APP_URL = 'http://localhost:3000';
export const SLOW_THRESHOLD_MS = 3000;
export const CHAR_DELAY_MS = 80;

// Normalised answers matching normalizeDictationTarget() in lib/utils.ts
export const LESSON_SENTENCES = [
  'the cat sat on the mat',       // 0  (22 chars)
  'a dog ran in the park',        // 1  (21 chars)
  'she likes to read books',      // 2  (23 chars)
  'the sun shines every day',     // 3  (24 chars)
  'he drinks cold water',         // 4  (20 chars)
  'birds sing in the morning',    // 5  (25 chars)
  'the sky is very blue',         // 6  (20 chars)
  'we eat lunch at noon',         // 7  (20 chars)
  'they walk to the store',       // 8  (22 chars)
  'rain falls from the clouds',   // 9  (26 chars)
  'who run switzerlands trains',  // 10 (27 chars) — SRT has U+02BC modifier apostrophe
];

// Start / end timestamps in seconds, from test-lesson.srt
export const SENTENCE_STARTS = [0.0, 1.8, 3.6, 5.4, 7.2, 9.0, 10.8, 12.6, 14.4, 16.2, 18.0];
export const SENTENCE_ENDS   = [1.2, 3.0, 4.8, 6.6, 8.4, 10.2, 12.0, 13.8, 15.6, 17.4, 19.2];

// ── Report ────────────────────────────────────────────────────────────────────
export interface ReportEntry {
  label: string;
  passed: boolean;
  durationMs: number;
  detail?: string;
}

export function createReport(): ReportEntry[] {
  return [];
}

export function printReport(report: ReportEntry[]) {
  const passed = report.filter(r => r.passed);
  const failed = report.filter(r => !r.passed);
  const slow   = report.filter(r => r.passed && r.durationMs >= SLOW_THRESHOLD_MS);

  console.log('\n════════════════════════════════════════');
  console.log('  DICTATION BASELINE TEST REPORT');
  console.log('════════════════════════════════════════');
  console.log(`  Total:  ${report.length}  |  Passed: ${passed.length}  |  Failed: ${failed.length}  |  Slow: ${slow.length}`);

  if (failed.length) {
    console.log('\n  FAILURES:');
    for (const r of failed) {
      console.log(`    ✗  ${r.label}  (${r.durationMs}ms)`);
      if (r.detail) console.log(`       ${r.detail.slice(0, 300)}`);
    }
  }
  if (slow.length) {
    console.log('\n  SLOW:');
    for (const r of slow) console.log(`    ⚠  ${r.label}  (${r.durationMs}ms)`);
  }
  if (!failed.length) console.log('\n  🎉  All assertions passed!');
  console.log('════════════════════════════════════════\n');
}

// ── Check (poll-until-pass assertion) ─────────────────────────────────────────
export async function check(
  report: ReportEntry[],
  label: string,
  fn: () => Promise<boolean | void>,
  timeoutMs = 4000
): Promise<boolean> {
  const t0 = Date.now();
  let passed = false;
  let detail: string | undefined;
  const deadline = t0 + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fn();
      if (r !== false) { passed = true; break; }
    } catch (e) { detail = String(e); }
    await sleep(60);
  }
  const ms = Date.now() - t0;
  report.push({ label, passed, durationMs: ms, detail });
  const slow = ms >= SLOW_THRESHOLD_MS;
  console.log(`  ${passed ? (slow ? '⚠ ' : '✓ ') : '✗ '}${label}${!passed ? ` — FAILED (${ms}ms)` : slow ? ` (${ms}ms slow)` : ''}`);
  if (!passed && detail) console.log(`      ${detail.slice(0, 200)}`);
  return passed;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Silent WAV ────────────────────────────────────────────────────────────────
function silentWavDataUrl(durationSeconds = 20, sampleRate = 16000): string {
  const n = Math.floor(durationSeconds * sampleRate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return `data:audio/wav;base64,${buf.toString('base64')}`;
}

export async function seedLesson(context: BrowserContext) {
  const srtFile = path.join(process.cwd(), 'scripts', 'fixtures', 'test-lesson.srt');
  const srt = fs.readFileSync(srtFile, 'utf8');
  const lesson = {
    id: 'e2e-test-001',
    name: 'E2E Test Lesson',
    transcriptText: srt,
    mediaDataUrl: silentWavDataUrl(),
  };
  await context.addInitScript((data: string) => {
    localStorage.setItem('__e2e_lesson__', data);
  }, JSON.stringify(lesson));
}

// ── Page helpers ──────────────────────────────────────────────────────────────

export async function seekToSentence(page: Page, index: number) {
  const start = SENTENCE_STARTS[index];
  await page.evaluate((t: number) => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    if (!m) return;
    m.currentTime = t;
    m.dispatchEvent(new Event('timeupdate'));
    void m.play().catch(() => {});
  }, start);
}

export async function waitForActive(page: Page, index: number, timeout = 4000) {
  await page.waitForFunction(
    (i: number) => document.querySelector(`[data-index="${i}"]`)?.className.includes('emerald') ?? false,
    index, { timeout }
  );
}

export async function typeAnswer(page: Page, answer: string) {
  const ta = page.locator('[data-dictation-input]');
  await ta.waitFor({ state: 'attached', timeout: 3000 });
  await ta.focus();
  for (const ch of answer) {
    await ta.pressSequentially(ch, { delay: CHAR_DELAY_MS });
  }
}

export async function waitForAllGreen(page: Page, index: number, timeout = 5000) {
  await page.waitForFunction(
    (i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      if (row.querySelector('.text-green-400')) return true;
      const green = row.querySelectorAll('span.text-emerald-500');
      const red   = row.querySelectorAll('span.text-red-500');
      const stars = [...row.querySelectorAll('span.text-gray-500')].filter(s => s.textContent === '*');
      return green.length > 0 && red.length === 0 && stars.length === 0;
    },
    index, { timeout }
  );
}

export async function pressEnter(page: Page) {
  const sr = page.locator('[aria-label="Press Enter to continue"]');
  await sr.waitFor({ state: 'attached', timeout: 3000 });
  await sr.press('Enter');
}

export async function isRowCompleted(page: Page, index: number): Promise<boolean> {
  return page.evaluate(
    (i: number) => document.querySelector(`[data-index="${i}"]`)?.querySelector('.text-green-400') !== null,
    index
  );
}

export async function isRowVisible(page: Page, index: number): Promise<boolean> {
  return page.evaluate((i: number) => {
    const row = document.querySelector(`[data-index="${i}"]`);
    if (!row) return false;
    const scroll = row.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroll) return true;
    const r = row.getBoundingClientRect(), s = scroll.getBoundingClientRect();
    return r.top >= s.top - 60 && r.bottom <= s.bottom + 60;
  }, index);
}

export async function countSpans(page: Page, index: number, className: string): Promise<number> {
  return page.evaluate(
    ([i, cls]: [number, string]) =>
      document.querySelector(`[data-index="${i}"]`)?.querySelectorAll(`span.${cls}`).length ?? 0,
    [index, className] as [number, string]
  );
}

export async function countStars(page: Page, index: number): Promise<number> {
  return page.evaluate(
    (i: number) => [...(document.querySelector(`[data-index="${i}"]`)?.querySelectorAll('span.text-gray-500') ?? [])]
      .filter(s => s.textContent === '*').length,
    index
  );
}

export async function getAudioTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    return m?.currentTime ?? -1;
  });
}

export async function isAudioPaused(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    return m?.paused ?? true;
  });
}

export async function pauseAudio(page: Page) {
  await page.evaluate(() => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    if (m) m.pause();
  });
}

export async function playAudio(page: Page) {
  await page.evaluate(() => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    if (m) void m.play().catch(() => {});
  });
}

export async function setAudioTime(page: Page, t: number) {
  await page.evaluate((time: number) => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    if (m) m.currentTime = time;
  }, t);
}

export async function dismissModal(page: Page) {
  const backdrop = page.locator('.app-modal-backdrop');
  if (await backdrop.count() > 0) {
    await page.keyboard.press('Escape');
    await sleep(300);
  }
}

export async function clearInput(page: Page) {
  const ta = page.locator('[data-dictation-input]');
  if (await ta.count() === 0) return;
  await ta.focus();
  await page.keyboard.down('Meta');
  await page.keyboard.press('a');
  await page.keyboard.up('Meta');
  await page.keyboard.press('Backspace');
  await sleep(80);
}

export async function activateClean(page: Page, index: number) {
  await seekToSentence(page, index);
  await waitForActive(page, index, 4_000);
  await pauseAudio(page);
  await clearInput(page);
}

export async function completeTyping(page: Page, index: number) {
  await typeAnswer(page, LESSON_SENTENCES[index]);
  await waitForAllGreen(page, index, 5_000);
}
