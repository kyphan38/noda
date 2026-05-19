#!/usr/bin/env npx tsx
/**
 * Playwright dictation E2E — baseline regression suite (runner).
 *
 * Prerequisites:  dev server running with E2E mode:
 *   NEXT_PUBLIC_E2E_MODE=true npm run dev
 *
 * Run:
 *   npx tsx scripts/test-dictation/run-all.ts
 *
 * Each group lives in its own file; this runner orchestrates them in order
 * with a shared browser context and combined report.
 */
import { chromium } from '@playwright/test';
import { createReport, printReport, seedLesson, ReportEntry } from './helpers.js';

import { run as runSetup }           from './01-setup.js';
import { run as runInput }           from './02-input.js';
import { run as runCompletion }      from './03-completion.js';
import { run as runBackspace }       from './04-backspace.js';
import { run as runKeyboard }        from './05-keyboard.js';
import { run as runAudioBoundaries } from './06-audio-boundaries.js';
import { run as runAudioAccuracy }   from './07-audio-accuracy.js';
import { run as runNavigation }      from './08-navigation.js';
import { run as runStateLifecycle }  from './09-state-lifecycle.js';
import { run as runMobile }          from './10-mobile.js';
import { run as runUnicode }         from './11-unicode-normalization.js';

const groups = [
  runSetup,
  runInput,
  runCompletion,
  runBackspace,
  runKeyboard,
  runAudioBoundaries,
  runAudioAccuracy,
  runNavigation,
  runStateLifecycle,
  runUnicode,
  runMobile,
];

async function main() {
  console.log('\n🎯  noda dictation E2E — baseline suite\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await seedLesson(context);
  const page = await context.newPage();

  const report: ReportEntry[] = createReport();

  for (const group of groups) {
    await group(page, report);
  }

  await browser.close();
  printReport(report);
  const failed = report.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
