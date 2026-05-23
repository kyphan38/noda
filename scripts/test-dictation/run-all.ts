#!/usr/bin/env npx tsx
/**
 * Playwright dictation E2E — baseline regression suite (runner).
 *
 * Prerequisites:  E2E dev server (port 3010, not 3000):
 *   npm run dev:e2e
 *
 * Run:
 *   npm run test:dictation
 *
 * Each group lives in its own file; this runner orchestrates them in order
 * with a shared browser context and combined report.
 */
import { chromium } from '@playwright/test';
import { createReport, printReport, seedLesson, ReportEntry } from './helpers.js';

import { run as runUnitUtils }       from './00-unit-utils.js';
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
import { run as runSpaceHandling }   from './12-space-handling.js';
import { run as runMobileAudioSync } from './13-mobile-audio-sync.js';
import { run as runPlayerPopovers }  from './14-player-popovers.js';
import { run as runSrtValidation }   from './15-srt-validation.js';
import { run as runDictationUi }     from './16-dictation-ui.js';

const groups = [
  runUnitUtils,
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
  runSpaceHandling,
  runMobileAudioSync,
  runPlayerPopovers,
  runSrtValidation,
  runDictationUi,
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
