#!/usr/bin/env npx tsx
/**
 * Group 0: Unit Tests — normalizeDictationTarget, alignDictationInput.
 *
 * No browser required. Runs in < 1 second.
 * These catch the exact class of bug that breaks dictation:
 * normalization/alignment changes that silently corrupt display or completion.
 *
 * Run standalone:  npx tsx scripts/test-dictation/00-unit-utils.ts
 * Run with suite:  npx tsx scripts/test-dictation/run-all.ts
 */
import { Page } from '@playwright/test';
import { ReportEntry } from './helpers.js';

import {
  normalizeDictationTarget,
  alignDictationInput,
} from '../../lib/utils.js';

function unitCheck(
  report: ReportEntry[],
  label: string,
  fn: () => boolean,
): boolean {
  const t0 = Date.now();
  let passed = false;
  let detail: string | undefined;
  try {
    passed = fn();
  } catch (e) {
    detail = String(e);
  }
  const ms = Date.now() - t0;
  report.push({ label, passed, durationMs: ms, detail });
  console.log(
    `  ${passed ? '✓ ' : '✗ '}${label}${!passed ? ` — FAILED` : ''}`,
  );
  if (!passed && detail) console.log(`      ${detail.slice(0, 200)}`);
  return passed;
}

function eq(a: string, b: string): boolean {
  if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  return true;
}

// ── normalizeDictationTarget ─────────────────────────────────────────────────

export async function run(_page: Page | null, report: ReportEntry[]) {
  console.log('\n─── 0. Unit: normalizeDictationTarget ───');

  unitCheck(report, '0a. Lowercase conversion', () =>
    eq(normalizeDictationTarget('The Cat SAT'), 'the cat sat'));

  unitCheck(report, '0b. Punctuation stripped', () =>
    eq(normalizeDictationTarget('hello, world!'), 'hello world'));

  unitCheck(report, '0c. Apostrophe stripped', () =>
    eq(normalizeDictationTarget("he drink's cold water"), 'he drinks cold water'));

  unitCheck(report, '0d. Unicode modifier letter U+02BC stripped', () =>
    eq(normalizeDictationTarget('Switzerlandʼs trains'), 'switzerlands trains'));

  unitCheck(report, '0e. Whitespace collapsed', () =>
    eq(normalizeDictationTarget('  the   cat  '), 'the cat'));

  unitCheck(report, '0f. Empty string', () =>
    eq(normalizeDictationTarget(''), ''));

  unitCheck(report, '0g. Only whitespace', () =>
    eq(normalizeDictationTarget('   '), ''));

  unitCheck(report, '0h. Numbers preserved', () =>
    eq(normalizeDictationTarget('123 abc'), '123 abc'));

  unitCheck(report, '0i. Trailing space stripped by default', () =>
    eq(normalizeDictationTarget('hello '), 'hello'));

  unitCheck(report, '0j. preserveTrailingSpace keeps trailing space', () =>
    eq(normalizeDictationTarget('hello ', { preserveTrailingSpace: true }), 'hello '));

  unitCheck(report, '0k. preserveTrailingSpace no-op when no trailing space', () =>
    eq(normalizeDictationTarget('hello', { preserveTrailingSpace: true }), 'hello'));

  unitCheck(report, '0l. Leading whitespace stripped', () =>
    eq(normalizeDictationTarget('  hello'), 'hello'));

  unitCheck(report, '0m. Tabs and newlines treated as spaces', () =>
    eq(normalizeDictationTarget('the\tcat\nsat'), 'the cat sat'));

  unitCheck(report, '0n. Only punctuation returns empty', () =>
    eq(normalizeDictationTarget('...!!!???'), ''));

  unitCheck(report, '0o. Mixed punctuation and letters', () =>
    eq(normalizeDictationTarget("it's a (test), right?"), 'its a test right'));

  // ── alignDictationInput ──────────────────────────────────────────────────────
  console.log('\n─── 0. Unit: alignDictationInput ───');

  const target1 = 'the cat sat on the mat';   // 22 chars, 6 words
  const target2 = 'who run switzerlands trains'; // 27 chars

  unitCheck(report, '0p. Basic alignment with auto-space', () =>
    eq(alignDictationInput('thec', target1), 'the c'));

  unitCheck(report, '0q. Full alignment no spaces typed', () =>
    eq(alignDictationInput('thecatsatonthemat', target1), 'the cat sat on the mat'));

  unitCheck(report, '0r. Empty input returns empty', () =>
    eq(alignDictationInput('', target1), ''));

  unitCheck(report, '0s. Overflow clamped to target length', () =>
    eq(alignDictationInput('thecatsatonthematxxx', target1), 'the cat sat on the mat'));

  unitCheck(report, '0t. Case insensitive alignment', () =>
    eq(alignDictationInput('THEC', target1), 'the c'));

  unitCheck(report, '0u. Punctuation in input stripped', () =>
    eq(alignDictationInput('the.c', target1), 'the c'));

  unitCheck(report, '0v. Input with explicit spaces aligned', () =>
    eq(alignDictationInput('the cat', target1), 'the cat'));

  unitCheck(report, '0w. Double spaces in input collapsed', () =>
    eq(alignDictationInput('the  cat', target1), 'the cat'));

  // ── Space display: the exact class of bug that prompted this suite ───────────
  console.log('\n─── 0. Unit: space display (trailing space) ───');

  unitCheck(report, '0x. Trailing space at word boundary preserved', () => {
    const result = alignDictationInput('the ', target1);
    return eq(result, 'the ');
  });

  unitCheck(report, '0y. Trailing space NOT at word boundary is not added', () => {
    const result = alignDictationInput('thec ', target1);
    // After alignment: "the c" (5 chars). Next target char is 'a' (not space).
    // So trailing space should not be added.
    return eq(result, 'the c');
  });

  unitCheck(report, '0z. Trailing space at second boundary', () => {
    const result = alignDictationInput('the cat ', target1);
    return eq(result, 'the cat ');
  });

  unitCheck(report, '0aa. Trailing space after full match not added', () => {
    const result = alignDictationInput('thecatsatonthemat ', target1);
    // All letters consumed, no more target positions → space not added.
    return eq(result, 'the cat sat on the mat');
  });

  unitCheck(report, '0ab. Multiple words with trailing space', () => {
    const result = alignDictationInput('who run ', target2);
    return eq(result, 'who run ');
  });

  unitCheck(report, '0ac. Partial word then space (not at boundary)', () => {
    const result = alignDictationInput('wh ', target2);
    // "wh" maps to "wh", next target position is 'o' (not space).
    return eq(result, 'wh');
  });

  // ── Alignment letter-count integrity ─────────────────────────────────────────
  console.log('\n─── 0. Unit: alignment integrity ───');

  unitCheck(report, '0ad. Letters in = letters out (no space typed)', () => {
    const input = 'thecat';
    const result = alignDictationInput(input, target1);
    const inLetters = input.replace(/ /g, '');
    const outLetters = result.replace(/ /g, '');
    return eq(outLetters, inLetters);
  });

  unitCheck(report, '0ae. Letters in = letters out (spaces typed)', () => {
    const input = 'the cat sat';
    const result = alignDictationInput(input, target1);
    const inLetters = normalizeDictationTarget(input).replace(/ /g, '');
    const outLetters = result.replace(/ /g, '');
    return eq(outLetters, inLetters);
  });

  unitCheck(report, '0af. Single-word target (no spaces)', () => {
    const result = alignDictationInput('hel', 'hello');
    return eq(result, 'hel');
  });

  unitCheck(report, '0ag. Single-word target full match', () => {
    const result = alignDictationInput('hello', 'hello');
    return eq(result, 'hello');
  });

  unitCheck(report, '0ah. Single char input', () =>
    eq(alignDictationInput('t', target1), 't'));

  unitCheck(report, '0ai. Completion detection: letters match', () => {
    const result = alignDictationInput('thecatsatonthemat', target1);
    const resultLetters = result.replace(/ /g, '');
    const targetLetters = target1.replace(/ /g, '');
    if (resultLetters !== targetLetters) {
      throw new Error(`Letters mismatch: ${JSON.stringify(resultLetters)} !== ${JSON.stringify(targetLetters)}`);
    }
    return true;
  });

  unitCheck(report, '0aj. Completion detection: letters match with explicit spaces', () => {
    const result = alignDictationInput('the cat sat on the mat', target1);
    const resultLetters = result.replace(/ /g, '');
    const targetLetters = target1.replace(/ /g, '');
    if (resultLetters !== targetLetters) {
      throw new Error(`Letters mismatch: ${JSON.stringify(resultLetters)} !== ${JSON.stringify(targetLetters)}`);
    }
    return true;
  });

  unitCheck(report, '0ak. Unicode target completion', () => {
    const target = normalizeDictationTarget('Switzerlandʼs trains');
    const result = alignDictationInput('switzerlandstrains', target);
    const resultLetters = result.replace(/ /g, '');
    const targetLetters = target.replace(/ /g, '');
    return eq(resultLetters, targetLetters);
  });
}

// ── Standalone runner ────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('00-unit-utils.ts') || process.argv[1]?.endsWith('00-unit-utils.js')) {
  const report: ReportEntry[] = [];
  run(null, report).then(() => {
    const passed = report.filter((r) => r.passed).length;
    const failed = report.filter((r) => !r.passed).length;
    console.log(`\n═══ Unit tests: ${passed} passed, ${failed} failed ═══\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
