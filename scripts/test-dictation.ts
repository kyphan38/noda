/**
 * Playwright dictation E2E test.
 *
 * Prerequisites:  dev server running with E2E mode:
 *   NEXT_PUBLIC_E2E_MODE=true npm run dev
 *
 * Run:
 *   npx tsx scripts/test-dictation.ts
 *
 * Outputs a REPORT of every assertion that failed or took too long.
 */
import { chromium, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Config ────────────────────────────────────────────────────────────────────
const APP_URL = 'http://localhost:3000';
const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const SRT_FILE = path.join(SCRIPTS_DIR, 'fixtures', 'test-lesson.srt');
const SLOW_THRESHOLD_MS = 3000; // typing 20 chars at 80ms = 1.6s+ is expected
const CHAR_DELAY_MS = 80;

// Normalised answers matching normalizeDictationTarget() in lib/utils.ts
const LESSON_SENTENCES = [
  'the cat sat on the mat',
  'a dog ran in the park',
  'she likes to read books',
  'the sun shines every day',
  'he drinks cold water',
  'birds sing in the morning',
  'the sky is very blue',
  'we eat lunch at noon',
  'they walk to the store',
  'rain falls from the clouds',
];

// Start timestamps in seconds, from test-lesson.srt
const SENTENCE_STARTS = [0.0, 1.8, 3.6, 5.4, 7.2, 9.0, 10.8, 12.6, 14.4, 16.2];

// ── REPORT ────────────────────────────────────────────────────────────────────
interface ReportEntry { label: string; passed: boolean; durationMs: number; detail?: string; }
const report: ReportEntry[] = [];

async function check(label: string, fn: () => Promise<boolean | void>, timeoutMs = 4000): Promise<boolean> {
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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Silent WAV (18 s, 16 kHz mono 16-bit) ────────────────────────────────────
function silentWavDataUrl(durationSeconds = 18, sampleRate = 16000): string {
  const n = Math.floor(durationSeconds * sampleRate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return `data:audio/wav;base64,${buf.toString('base64')}`;
}

// ── Seed the E2E lesson into localStorage before the app boots ────────────────
async function seedLesson(context: BrowserContext) {
  const srt = fs.readFileSync(SRT_FILE, 'utf8');
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

// ── Activate a sentence by seeking the audio element ─────────────────────────
async function seekToSentence(page: Page, index: number) {
  const start = SENTENCE_STARTS[index];
  await page.evaluate((t: number) => {
    const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
    if (!m) return;
    m.currentTime = t;
    m.dispatchEvent(new Event('timeupdate'));
    void m.play().catch(() => {});
  }, start);
}

/** Wait for sentence row to show the emerald active highlight. */
async function waitForActive(page: Page, index: number, timeout = 4000) {
  await page.waitForFunction(
    (i: number) => document.querySelector(`[data-index="${i}"]`)?.className.includes('emerald') ?? false,
    index, { timeout }
  );
}

/** Type answer char-by-char into the off-screen dictation textarea. */
async function typeAnswer(page: Page, answer: string) {
  const ta = page.locator('[data-dictation-input]');
  await ta.waitFor({ state: 'attached', timeout: 3000 });
  await ta.focus();
  for (const ch of answer) {
    await ta.pressSequentially(ch, { delay: CHAR_DELAY_MS });
  }
}

/** Wait until the active row has all-green chars — or has already transitioned to completed state. */
async function waitForAllGreen(page: Page, index: number, timeout = 5000) {
  await page.waitForFunction(
    (i: number) => {
      const row = document.querySelector(`[data-index="${i}"]`);
      if (!row) return false;
      // Completed state: DictationControls renders a single div.text-green-400 with the full target text.
      // This appears immediately once the sentence is marked done, before Enter is pressed.
      if (row.querySelector('.text-green-400')) return true;
      // Still-typing state: all chars are emerald-correct, none red, none untyped (*).
      const green = row.querySelectorAll('span.text-emerald-500');
      const red   = row.querySelectorAll('span.text-red-500');
      const stars = [...row.querySelectorAll('span.text-gray-500')].filter(s => s.textContent === '*');
      return green.length > 0 && red.length === 0 && stars.length === 0;
    },
    index, { timeout }
  );
}

/** Press Enter on the sr-only input that receives focus after sentence completion. */
async function pressEnter(page: Page) {
  const sr = page.locator('[aria-label="Press Enter to continue"]');
  await sr.waitFor({ state: 'attached', timeout: 3000 });
  await sr.press('Enter');
}

/** True if sentence row is completed (shows .text-green-400 target text). */
async function isCompleted(page: Page, index: number): Promise<boolean> {
  return page.evaluate(
    (i: number) => document.querySelector(`[data-index="${i}"]`)?.querySelector('.text-green-400') !== null,
    index
  );
}

/** True if the active sentence row is scrolled into the overflow container. */
async function isVisible(page: Page, index: number): Promise<boolean> {
  return page.evaluate((i: number) => {
    const row = document.querySelector(`[data-index="${i}"]`);
    if (!row) return false;
    const scroll = row.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroll) return true;
    const r = row.getBoundingClientRect(), s = scroll.getBoundingClientRect();
    return r.top >= s.top - 60 && r.bottom <= s.bottom + 60;
  }, index);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎯  noda dictation E2E\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await seedLesson(context);
  const page = await context.newPage();

  // ── 1. Auth + app load ─────────────────────────────────────────────────────
  console.log('─── 1. Load app (E2E mode) ───');
  await page.goto(APP_URL);

  await check('App bypasses auth screen', async () => {
    // In E2E mode the app skips the login view — wait for transcript sentences
    await page.waitForSelector('[data-index="0"]', { timeout: 20_000 });
  }, 22_000);

  // ── 2. Switch to Dictation ─────────────────────────────────────────────────
  console.log('\n─── 2. Dictation mode ───');

  await check('Dictation tab visible', async () => {
    const tab = page.locator('nav[aria-label="Lesson mode"] button', { hasText: 'Dictation' });
    await tab.waitFor({ state: 'visible', timeout: 5_000 });
    await tab.click();
    await sleep(300);
  }, 7_000);

  await check('Dictation tab is active (aria-current)', async () => {
    const cur = page.locator('nav[aria-label="Lesson mode"] button[aria-current="page"]');
    return (await cur.textContent())?.trim() === 'Dictation';
  });

  // ── 3. Core dictation — sentences 1–5 ─────────────────────────────────────
  console.log('\n─── 3. Sentences 1–5 ───');

  for (let i = 0; i < 5; i++) {
    console.log(`\n  Sentence ${i + 1}: "${LESSON_SENTENCES[i]}"`);

    await check(`[${i+1}] Activates on seek`, async () => {
      await seekToSentence(page, i);
      await waitForActive(page, i, 4_000);
    }, 6_000);

    await check(`[${i+1}] Accepts typed input`, async () => {
      await typeAnswer(page, LESSON_SENTENCES[i]);
    }, 15_000);

    await check(`[${i+1}] All chars green`, async () => {
      await waitForAllGreen(page, i, 3_000);
    }, 4_000);

    await check(`[${i+1}] Enter advances to sentence ${i+2}`, async () => {
      await pressEnter(page);
      if (i < 4) await waitForActive(page, i + 1, 4_000);
    }, 6_000);

    await check(`[${i+1}] Completed row shows green target text`, async () => isCompleted(page, i));

    if (i < 4) {
      await check(`[${i+1}] Next sentence scrolled into view`, async () => isVisible(page, i + 1));
    }
  }

  // ── 4. Edge cases ──────────────────────────────────────────────────────────
  console.log('\n─── 4. Edge cases ───');

  // 4a. Wrong chars → red → backspace → retype
  console.log('\n  4a. Wrong chars → backspace → retype');
  await check('Activate sentence 6', async () => {
    await seekToSentence(page, 5);
    await waitForActive(page, 5, 4_000);
  }, 6_000);

  await check('Wrong chars show red spans', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.pressSequentially('zzz', { delay: CHAR_DELAY_MS });
    return page.evaluate((i: number) =>
      (document.querySelector(`[data-index="${i}"]`)?.querySelectorAll('span.text-red-500').length ?? 0) > 0, 5);
  });

  await check('Backspace clears wrong chars', async () => {
    const ta = page.locator('[data-dictation-input]');
    for (let j = 0; j < 3; j++) await ta.press('Backspace');
    await sleep(100);
    return page.evaluate((i: number) =>
      (document.querySelector(`[data-index="${i}"]`)?.querySelectorAll('span.text-red-500').length ?? 0) === 0, 5);
  });

  await check('Correct answer after wrong chars → all green', async () => {
    // Audio may have drifted past sentence 6's end during the wrong-chars phase — re-seek to restore it.
    await seekToSentence(page, 5);
    await waitForActive(page, 5, 3_000);
    await typeAnswer(page, LESSON_SENTENCES[5]);
    await waitForAllGreen(page, 5, 3_000);
  }, 15_000);

  await pressEnter(page).catch(() => {});

  // 4b. Click row below → audio seeks
  console.log('\n  4b. Click row below → seeks audio');
  const clickIdx = 7;
  await check(`Clicking row ${clickIdx + 1} seeks audio near its start`, async () => {
    const row = page.locator(`[data-index="${clickIdx}"]`);
    await row.waitFor({ state: 'visible', timeout: 3_000 });
    await row.click();
    await sleep(300);
    return page.evaluate(([idx, starts]: [number, number[]]) => {
      const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
      if (!m) return false;
      return Math.abs(m.currentTime - starts[idx]) < 2.5;
    }, [clickIdx, SENTENCE_STARTS] as [number, number[]]);
  });

  // 4c. Tab hint fills next character
  console.log('\n  4c. Tab fills next correct character');
  await check('Activate sentence 8', async () => {
    await seekToSentence(page, 7);
    await waitForActive(page, 7, 4_000);
  }, 6_000);

  await check('Tab adds one green character', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    await ta.press('Tab');
    await sleep(150);
    return page.evaluate((i: number) =>
      (document.querySelector(`[data-index="${i}"]`)?.querySelectorAll('span.text-emerald-500').length ?? 0) > 0, 7);
  });

  // 4d. Ctrl replays sentence
  console.log('\n  4d. Ctrl replays current sentence');
  await check('Ctrl seeks audio back to sentence start', async () => {
    const ta = page.locator('[data-dictation-input]');
    await ta.waitFor({ state: 'attached', timeout: 3_000 });
    await ta.focus();
    // Advance audio 0.5 s past sentence 8's start so we have room to detect a seek-back.
    await page.evaluate((t: number) => {
      const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
      if (m) { m.currentTime = t + 0.5; }
    }, SENTENCE_STARTS[7]);
    await sleep(80);
    await ta.press('Control');
    // Poll (don't sleep a fixed amount) — the seek happens synchronously in the event handler,
    // but React state + RAF need one tick to reflect it. 800 ms is enough, and shorter
    // than the 1.2 s sentence length, so the audio won't have played past start+0.3.
    await page.waitForFunction(
      ([idx, starts]: [number, number[]]) => {
        const m = (document.querySelector('audio') ?? document.querySelector('video')) as HTMLMediaElement | null;
        if (!m) return false;
        return m.currentTime <= starts[idx] + 0.4;
      },
      [7, SENTENCE_STARTS] as [number, number[]],
      { timeout: 1_500 }
    );
    return true;
  });

  await browser.close();
  printReport();
}

function printReport() {
  const passed = report.filter(r => r.passed);
  const failed = report.filter(r => !r.passed);
  const slow   = report.filter(r => r.passed && r.durationMs >= SLOW_THRESHOLD_MS);

  console.log('\n════════════════════════════════════════');
  console.log('  DICTATION TEST REPORT');
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
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); printReport(); process.exit(1); });
