#!/usr/bin/env npx tsx
/**
 * Group 15: SRT Timing Validation — detect subtitle/audio timestamp misalignment.
 *
 * No browser required. Tests parseTranscript correctness and SRT timing
 * consistency. Catches the class of bug where SRT timestamps don't match
 * actual audio content (e.g. at 1:19 the audio says "for stories on our"
 * but the SRT maps that time to a different sentence).
 *
 * Run standalone:  npx tsx scripts/test-dictation/15-srt-validation.ts
 * Run with suite:  npx tsx scripts/test-dictation/run-all.ts
 */
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ReportEntry } from './helpers.js';
import { parseTranscript, normalizeDictationTarget } from '../../lib/utils.js';
import type { Sentence } from '../../types/index.js';

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
  if (!passed && detail) console.log(`      ${detail.slice(0, 400)}`);
  return passed;
}

// ── Timing validation helpers ────────────────────────────────────────────────

interface TimingIssue {
  lineId: number;
  type: 'overlap' | 'negative-duration' | 'speaking-rate-high' | 'speaking-rate-low';
  message: string;
}

function findTimingIssues(sentences: Sentence[]): TimingIssue[] {
  const issues: TimingIssue[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const duration = s.end - s.start;

    if (duration <= 0) {
      issues.push({
        lineId: s.id,
        type: 'negative-duration',
        message: `Line ${s.id}: duration ${duration.toFixed(3)}s (start=${s.start.toFixed(3)}, end=${s.end.toFixed(3)})`,
      });
      continue;
    }

    if (i < sentences.length - 1 && s.end > sentences[i + 1].start + 0.001) {
      issues.push({
        lineId: s.id,
        type: 'overlap',
        message: `Line ${s.id} ends at ${s.end.toFixed(3)}s but line ${sentences[i + 1].id} starts at ${sentences[i + 1].start.toFixed(3)}s`,
      });
    }

    const words = s.text.split(/\s+/).filter(w => w).length;
    if (words === 0) continue;
    const wps = words / duration;

    if (wps > 9) {
      issues.push({
        lineId: s.id,
        type: 'speaking-rate-high',
        message: `Line ${s.id}: ${wps.toFixed(1)} words/sec (${words} words in ${duration.toFixed(2)}s) — exceeds 9 wps threshold`,
      });
    }

    if (wps < 0.8 && words > 2) {
      issues.push({
        lineId: s.id,
        type: 'speaking-rate-low',
        message: `Line ${s.id}: ${wps.toFixed(1)} words/sec (${words} words in ${duration.toFixed(2)}s) — below 0.8 wps threshold`,
      });
    }
  }

  return issues;
}

function findActiveSentence(sentences: Sentence[], time: number): Sentence | undefined {
  return sentences.find(s => time >= s.start && time < s.end);
}

function wordsPerSec(s: Sentence): number {
  const d = s.end - s.start;
  if (d <= 0) return 0;
  return s.text.split(/\s+/).filter(w => w).length / d;
}

interface RelativeAnomaly {
  lineId: number;
  wps: number;
  neighborAvgWps: number;
  ratio: number;
  message: string;
}

function findRelativeTimingAnomalies(
  sentences: Sentence[],
  ratioThreshold = 2.5,
  windowSize = 2,
): RelativeAnomaly[] {
  const anomalies: RelativeAnomaly[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const d = s.end - s.start;
    if (d <= 0) continue;
    const words = s.text.split(/\s+/).filter(w => w).length;
    if (words <= 1) continue;

    const neighbors: number[] = [];
    for (let j = Math.max(0, i - windowSize); j <= Math.min(sentences.length - 1, i + windowSize); j++) {
      if (j === i) continue;
      const nd = sentences[j].end - sentences[j].start;
      const nw = sentences[j].text.split(/\s+/).filter(w => w).length;
      if (nd > 0 && nw > 1) neighbors.push(nw / nd);
    }
    if (neighbors.length === 0) continue;

    const avgNeighbor = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
    const wps = words / d;
    const ratio = avgNeighbor > 0 ? wps / avgNeighbor : 0;
    const invRatio = wps > 0 ? avgNeighbor / wps : 0;

    if (ratio >= ratioThreshold || invRatio >= ratioThreshold) {
      anomalies.push({
        lineId: s.id,
        wps,
        neighborAvgWps: avgNeighbor,
        ratio: Math.max(ratio, invRatio),
        message: `Line ${s.id}: ${wps.toFixed(1)} wps vs neighbor avg ${avgNeighbor.toFixed(1)} wps (${Math.max(ratio, invRatio).toFixed(1)}x ${ratio >= ratioThreshold ? 'faster' : 'slower'}) — "${s.text.slice(0, 50)}"`,
      });
    }
  }
  return anomalies;
}

interface DriftResult {
  earlyAvgWps: number;
  lateAvgWps: number;
  ratio: number;
  drifted: boolean;
}

function detectCumulativeDrift(
  sentences: Sentence[],
  slicePercent = 0.2,
  driftThreshold = 1.8,
): DriftResult {
  const valid = sentences.filter(s => {
    const d = s.end - s.start;
    const w = s.text.split(/\s+/).filter(w => w).length;
    return d > 0 && w > 1;
  });
  if (valid.length < 10) return { earlyAvgWps: 0, lateAvgWps: 0, ratio: 1, drifted: false };

  const sliceSize = Math.max(3, Math.floor(valid.length * slicePercent));
  const early = valid.slice(0, sliceSize);
  const late = valid.slice(-sliceSize);

  const avg = (arr: Sentence[]) => {
    const rates = arr.map(s => wordsPerSec(s));
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  };

  const earlyAvg = avg(early);
  const lateAvg = avg(late);
  const ratio = earlyAvg > 0 && lateAvg > 0
    ? Math.max(earlyAvg / lateAvg, lateAvg / earlyAvg)
    : 1;

  return { earlyAvgWps: earlyAvg, lateAvgWps: lateAvg, ratio, drifted: ratio >= driftThreshold };
}

function maskPattern(text: string): string {
  const norm = normalizeDictationTarget(text);
  return norm.split(' ').map(w => '*'.repeat(w.length)).join(' ');
}

// ── Test runner ──────────────────────────────────────────────────────────────

export async function run(_page: Page | null, report: ReportEntry[]) {
  console.log('\n─── 15. SRT Timing Validation ───');

  // ── parseTranscript correctness ──────────────────────────────────────────────

  unitCheck(report, '15a. parseTranscript: correct timestamp conversion', () => {
    const srt = [
      '1', '00:00:06,840 --> 00:00:11,750', 'Hello world.', '',
      '2', '00:01:18,700 --> 00:01:19,760', 'And along the way,',
    ].join('\n');
    const result = parseTranscript(srt);
    if (result.length !== 2) throw new Error(`Expected 2 sentences, got ${result.length}`);
    if (Math.abs(result[0].start - 6.84) > 0.001)
      throw new Error(`Line 1 start: expected 6.84, got ${result[0].start}`);
    if (Math.abs(result[0].end - 11.75) > 0.001)
      throw new Error(`Line 1 end: expected 11.75, got ${result[0].end}`);
    if (Math.abs(result[1].start - 78.7) > 0.001)
      throw new Error(`Line 2 start: expected 78.7, got ${result[1].start}`);
    if (Math.abs(result[1].end - 79.76) > 0.001)
      throw new Error(`Line 2 end: expected 79.76, got ${result[1].end}`);
    return true;
  });

  unitCheck(report, '15b. parseTranscript: preserves text content', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'Hello, world!', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'Line two.',
    ].join('\n');
    const result = parseTranscript(srt);
    if (result[0].text !== 'Hello, world!')
      throw new Error(`Expected "Hello, world!", got "${result[0].text}"`);
    if (result[1].text !== 'Line two.')
      throw new Error(`Expected "Line two.", got "${result[1].text}"`);
    return true;
  });

  unitCheck(report, '15c. parseTranscript: handles empty input', () => {
    if (parseTranscript('').length !== 0) throw new Error('Non-empty result for empty input');
    return true;
  });

  unitCheck(report, '15d. parseTranscript: handles multi-line subtitle text', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'Line one', 'continues here.',
    ].join('\n');
    const result = parseTranscript(srt);
    if (result[0].text !== 'Line one\ncontinues here.')
      throw new Error(`Expected multi-line text, got "${result[0].text}"`);
    return true;
  });

  unitCheck(report, '15d2. parseTranscript: skips malformed/truncated blocks', () => {
    // Missing timestamp line
    const srt1 = ['1', 'No timestamp here', 'Hello.', '', '2', '00:00:01,000 --> 00:00:02,000', 'Valid.'].join('\n');
    const r1 = parseTranscript(srt1);
    if (r1.length !== 1 || r1[0].text !== 'Valid.')
      throw new Error(`Expected 1 valid sentence, got ${r1.length}: ${r1.map(s => s.text).join(', ')}`);

    // Block with only a number (truncated)
    const srt2 = ['1', '00:00:00,000 --> 00:00:01,000', 'Good.', '', '2'].join('\n');
    const r2 = parseTranscript(srt2);
    if (r2.length !== 1)
      throw new Error(`Truncated block: expected 1 sentence, got ${r2.length}`);

    // Empty text lines
    const srt3 = ['1', '00:00:00,000 --> 00:00:01,000', '', '', '2', '00:00:01,000 --> 00:00:02,000', 'OK.'].join('\n');
    const r3 = parseTranscript(srt3);
    const withText = r3.filter(s => s.text.trim().length > 0);
    if (withText.length < 1)
      throw new Error(`Expected at least 1 sentence with text, got ${withText.length}`);
    return true;
  });

  unitCheck(report, '15e. parseTranscript: handles Windows line endings', () => {
    const srt = '1\r\n00:00:00,000 --> 00:00:01,000\r\nHello.\r\n\r\n2\r\n00:00:01,000 --> 00:00:02,000\r\nWorld.';
    const result = parseTranscript(srt);
    if (result.length !== 2) throw new Error(`Expected 2 sentences, got ${result.length}`);
    return true;
  });

  // ── Sentence matching determinism ──────────────────────────────────────────

  unitCheck(report, '15f. Matching: overlapping SRT produces multiple matches with filter', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:03,000', 'B',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const atOverlap = sentences.filter(s => 1.5 >= s.start && 1.5 < s.end);
    if (atOverlap.length !== 2)
      throw new Error(`Expected 2 active at t=1.5 in overlapping SRT, got ${atOverlap.length}`);
    const first = findActiveSentence(sentences, 1.5);
    if (!first || first.id !== 1)
      throw new Error(`findActiveSentence should return first match (line 1), got ${first?.id ?? 'none'}`);
    return true;
  });

  unitCheck(report, '15f2. Matching: non-overlapping SRT has at most one active', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'B', '',
      '3', '00:00:02,500 --> 00:00:03,500', 'C',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const testTimes = [0, 0.5, 0.999, 1.0, 1.5, 1.999, 2.0, 2.25, 2.5, 3.0, 3.499, 3.5, 4.0];
    for (const t of testTimes) {
      const active = sentences.filter(s => t >= s.start && t < s.end);
      if (active.length > 1)
        throw new Error(`${active.length} active at t=${t}: ${active.map(s => s.id).join(',')}`);
    }
    return true;
  });

  unitCheck(report, '15g. Matching: exclusive upper bound (end time activates next)', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'B',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const atBoundary = findActiveSentence(sentences, 1.0);
    if (!atBoundary || atBoundary.id !== 2)
      throw new Error(`At t=1.0, expected line 2, got ${atBoundary?.id ?? 'none'}`);
    return true;
  });

  unitCheck(report, '15h. Matching: gap between sentences returns no active', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:02,000 --> 00:00:03,000', 'B',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const inGap = findActiveSentence(sentences, 1.5);
    if (inGap) throw new Error(`Expected no active at t=1.5, got line ${inGap.id}`);
    return true;
  });

  // ── Timing quality detection ───────────────────────────────────────────────

  unitCheck(report, '15i. Detection: finds overlapping timestamps', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,500', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,500', 'B',
    ].join('\n');
    const issues = findTimingIssues(parseTranscript(srt));
    const overlaps = issues.filter(i => i.type === 'overlap');
    if (overlaps.length !== 1)
      throw new Error(`Expected 1 overlap, found ${overlaps.length}`);
    return true;
  });

  unitCheck(report, '15j. Detection: finds negative durations', () => {
    const srt = [
      '1', '00:00:02,000 --> 00:00:01,000', 'Backwards',
    ].join('\n');
    const issues = findTimingIssues(parseTranscript(srt));
    const negatives = issues.filter(i => i.type === 'negative-duration');
    if (negatives.length !== 1)
      throw new Error(`Expected 1 negative duration, found ${negatives.length}`);
    return true;
  });

  unitCheck(report, '15k. Detection: flags impossible speaking rate', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:00,500',
      'This is way too many words to say in half a second obviously',
    ].join('\n');
    const issues = findTimingIssues(parseTranscript(srt));
    const rateIssues = issues.filter(i => i.type === 'speaking-rate-high');
    if (rateIssues.length !== 1)
      throw new Error(`Expected 1 high-rate issue, found ${rateIssues.length}`);
    return true;
  });

  unitCheck(report, '15k2. Detection: flags low speaking rate (< 0.8 wps)', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:05,500',
      'Only three words here',
    ].join('\n');
    const issues = findTimingIssues(parseTranscript(srt));
    const rateIssues = issues.filter(i => i.type === 'speaking-rate-low');
    if (rateIssues.length !== 1)
      throw new Error(`Expected 1 low-rate issue for 4 words in 5.5s (0.73 wps), found ${rateIssues.length}`);
    return true;
  });

  unitCheck(report, '15k3. Detection: normal speaking rate (>= 0.8 wps) not flagged', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:04,000',
      'These four words pass easily',
    ].join('\n');
    const issues = findTimingIssues(parseTranscript(srt));
    const rateIssues = issues.filter(i => i.type === 'speaking-rate-low');
    if (rateIssues.length !== 0)
      throw new Error(`5 words in 4s (1.25 wps) should not be flagged, found ${rateIssues.length} issues`);
    return true;
  });

  unitCheck(report, '15l. Detection: clean SRT has no issues', () => {
    const srtPath = path.join(process.cwd(), 'scripts', 'fixtures', 'test-lesson.srt');
    const srt = fs.readFileSync(srtPath, 'utf8');
    const issues = findTimingIssues(parseTranscript(srt));
    if (issues.length > 0)
      throw new Error(`Test fixture should be clean but found ${issues.length} issues:\n${issues.map(i => i.message).join('\n')}`);
    return true;
  });

  // ── Real SRT validation (Switzerland video) ──────────────────────────────────

  const realSrtPath = path.join(process.cwd(), 'audio',
    'How_Switzerland_Engineered_the_Perfect_Country_OMbV1rIPhCg.srt');

  if (fs.existsSync(realSrtPath)) {
    const srtContent = fs.readFileSync(realSrtPath, 'utf8');
    const sentences = parseTranscript(srtContent);

    unitCheck(report, '15m. Real SRT: parses all 822 sentences', () => {
      if (sentences.length !== 822)
        throw new Error(`Expected 822 sentences, got ${sentences.length}`);
      return true;
    });

    unitCheck(report, '15n. Real SRT: no negative durations', () => {
      const bad = sentences.filter(s => s.end <= s.start);
      if (bad.length > 0)
        throw new Error(`${bad.length} sentences with zero/negative duration: ${bad.map(s => `Line ${s.id}`).join(', ')}`);
      return true;
    });

    unitCheck(report, '15o. Real SRT: no overlapping timestamps', () => {
      const issues = findTimingIssues(sentences).filter(i => i.type === 'overlap');
      if (issues.length > 0)
        throw new Error(`${issues.length} overlaps found:\n${issues.slice(0, 5).map(i => i.message).join('\n')}`);
      return true;
    });

    unitCheck(report, '15p. Real SRT: speaking rate within bounds', () => {
      const issues = findTimingIssues(sentences).filter(
        i => i.type === 'speaking-rate-high' || i.type === 'speaking-rate-low'
      );
      if (issues.length > 0)
        throw new Error(`${issues.length} rate issues:\n${issues.slice(0, 10).map(i => i.message).join('\n')}`);
      return true;
    });

    unitCheck(report, '15q. Real SRT line 22: timestamp and text match expected', () => {
      const line22 = sentences.find(s => s.id === 22);
      if (!line22) throw new Error('Line 22 not found in parsed output');
      if (Math.abs(line22.start - 78.7) > 0.01)
        throw new Error(`Line 22 start: expected 78.7s, got ${line22.start}s`);
      if (Math.abs(line22.end - 79.76) > 0.01)
        throw new Error(`Line 22 end: expected 79.76s, got ${line22.end}s`);
      if (line22.text !== 'And along the way,')
        throw new Error(`Line 22 text: expected "And along the way,", got "${line22.text}"`);
      return true;
    });

    unitCheck(report, '15r. Real SRT: at t=79.0s sentence matching returns line 22', () => {
      const active = findActiveSentence(sentences, 79.0);
      if (!active)
        throw new Error('No active sentence at t=79.0s');
      if (active.id !== 22)
        throw new Error(`At t=79.0s, expected line 22, got line ${active.id} ("${active.text}")`);
      return true;
    });

    unitCheck(report, '15s. Real SRT line 22: speaking rate within normal range', () => {
      const line22 = sentences.find(s => s.id === 22);
      if (!line22) throw new Error('Line 22 not found');
      const duration = line22.end - line22.start;
      const words = line22.text.split(/\s+/).filter(w => w).length;
      const wps = words / duration;
      if (wps < 0.8)
        throw new Error(`Line 22 ("${line22.text}"): ${wps.toFixed(2)} wps — below 0.8 threshold`);
      const issues = findTimingIssues([line22]);
      const rateIssues = issues.filter(i => i.type === 'speaking-rate-low');
      if (rateIssues.length > 0)
        throw new Error(`Line 22 unexpectedly flagged: ${rateIssues[0].message}`);
      return true;
    });

    unitCheck(report, '15s2. Detection: low-rate check skips 2-word sentences (words > 2 guard)', () => {
      // findTimingIssues only flags speaking-rate-low when words > 2.
      // A 2-word sentence in a long duration (e.g. "Thank you" in 10s) is
      // plausible (pause, transition) and should NOT be flagged.
      const srt = [
        '1', '00:00:00,000 --> 00:00:10,000', 'Thank you',
      ].join('\n');
      const issues = findTimingIssues(parseTranscript(srt));
      const lowRate = issues.filter(i => i.type === 'speaking-rate-low');
      if (lowRate.length > 0)
        throw new Error(`2-word sentence should be exempt from low-rate check, but got: ${lowRate[0].message}`);

      // A 3-word sentence in a longer duration SHOULD be flagged (0.27 wps < 0.8)
      const srt2 = [
        '1', '00:00:00,000 --> 00:00:11,000', 'Thank you kindly',
      ].join('\n');
      const issues2 = findTimingIssues(parseTranscript(srt2));
      const lowRate2 = issues2.filter(i => i.type === 'speaking-rate-low');
      if (lowRate2.length !== 1)
        throw new Error(`3-word sentence at 0.27 wps should be flagged, got ${lowRate2.length} issues`);
      return true;
    });

    unitCheck(report, '15t. Real SRT lines 21-24: continuous timeline (no large gaps)', () => {
      const line21 = sentences.find(s => s.id === 21)!;
      const line22 = sentences.find(s => s.id === 22)!;
      const line23 = sentences.find(s => s.id === 23)!;
      const line24 = sentences.find(s => s.id === 24)!;
      if (!line21 || !line22 || !line23 || !line24) throw new Error('Missing lines 21-24');
      const gap21to22 = line22.start - line21.end;
      const gap22to23 = line23.start - line22.end;
      const gap23to24 = line24.start - line23.end;
      if (gap21to22 > 9.0)
        throw new Error(`Gap between line 21 and 22: ${gap21to22.toFixed(3)}s — may indicate missing content`);
      if (gap22to23 > 0.5)
        throw new Error(`Gap between line 22 and 23: ${gap22to23.toFixed(3)}s — may indicate missing content`);
      if (gap23to24 > 0.5)
        throw new Error(`Gap between line 23 and 24: ${gap23to24.toFixed(3)}s — may indicate missing content`);
      return true;
    });
  } else {
    console.log('  ⊘ Real SRT file not found — skipping real-file tests');
  }

  // ── Relative timing anomaly detection ──────────────────────────────────────

  console.log('\n─── 15. Relative Timing Anomalies ───');

  unitCheck(report, '15u. Anomaly detection: finds outlier among neighbors', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'This is a normal sentence here', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Another normal speed sentence too', '',
      '3', '00:00:04,000 --> 00:00:04,300', 'Way too many words crammed into this tiny window really fast now', '',
      '4', '00:00:04,300 --> 00:00:06,300', 'Back to a normal speaking rate again', '',
      '5', '00:00:06,300 --> 00:00:08,300', 'And another perfectly normal sentence',
    ].join('\n');
    const anomalies = findRelativeTimingAnomalies(parseTranscript(srt));
    if (anomalies.length === 0)
      throw new Error('Expected to detect the outlier sentence 3');
    if (!anomalies.some(a => a.lineId === 3))
      throw new Error(`Detected anomalies at lines ${anomalies.map(a => a.lineId).join(',')}, expected line 3`);
    return true;
  });

  unitCheck(report, '15v. Anomaly detection: consistent-rate SRT has no anomalies', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'Five words in this sentence', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Also five words right here', '',
      '3', '00:00:04,000 --> 00:00:06,000', 'Still five words per line', '',
      '4', '00:00:06,000 --> 00:00:08,000', 'Keeping the same word count', '',
      '5', '00:00:08,000 --> 00:00:10,000', 'Final five words to check',
    ].join('\n');
    const anomalies = findRelativeTimingAnomalies(parseTranscript(srt));
    if (anomalies.length > 0)
      throw new Error(`Consistent-rate SRT should have no anomalies but found: ${anomalies.map(a => a.message).join('; ')}`);
    return true;
  });

  unitCheck(report, '15w. Anomaly detection: slow outlier among fast neighbors', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'Quick words from the speaker', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'Another fast sentence here ok', '',
      '3', '00:00:02,000 --> 00:00:10,000', 'A slow drawn out sentence here', '',
      '4', '00:00:10,000 --> 00:00:11,000', 'More quick words from the person', '',
      '5', '00:00:11,000 --> 00:00:12,000', 'Final fast sentence right here',
    ].join('\n');
    const anomalies = findRelativeTimingAnomalies(parseTranscript(srt));
    if (!anomalies.some(a => a.lineId === 3))
      throw new Error('Expected to detect slow outlier at line 3');
    return true;
  });

  if (fs.existsSync(realSrtPath)) {
    const srtContent = fs.readFileSync(realSrtPath, 'utf8');
    const sentences = parseTranscript(srtContent);

    unitCheck(report, '15x. Real SRT: relative anomalies count is low', () => {
      const anomalies = findRelativeTimingAnomalies(sentences);
      const threshold = Math.ceil(sentences.length * 0.03);
      if (anomalies.length > threshold)
        throw new Error(`${anomalies.length} anomalies (>${threshold} = 3% of ${sentences.length} lines):\n${anomalies.slice(0, 8).map(a => a.message).join('\n')}`);
      return true;
    });

    unitCheck(report, '15y. Real SRT lines 20-26: no relative anomalies after hallucination fix', () => {
      const nearby = sentences.filter(s => s.id >= 20 && s.id <= 26);
      const anomalies = findRelativeTimingAnomalies(nearby);
      if (anomalies.length > 0)
        throw new Error(`Unexpected anomalies in lines 20-26:\n${anomalies.map(a => a.message).join('\n')}`);
      return true;
    });
  }

  // ── Cumulative drift detection ─────────────────────────────────────────────

  console.log('\n─── 15. Cumulative Drift Detection ───');

  unitCheck(report, '15z. Drift detection: uniform SRT has no drift', () => {
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push(`${i + 1}`, `00:00:${String(i * 2).padStart(2, '0')},000 --> 00:00:${String(i * 2 + 1).padStart(2, '0')},800`, `Sentence number ${i + 1} is here`, '');
    }
    const result = detectCumulativeDrift(parseTranscript(lines.join('\n')));
    if (result.drifted)
      throw new Error(`Uniform SRT should not drift, ratio=${result.ratio.toFixed(2)}`);
    return true;
  });

  unitCheck(report, '15aa. Drift detection: catches accelerating SRT', () => {
    const fmt = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      const whole = Math.floor(s);
      const ms = Math.round((s - whole) * 1000);
      return `00:${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };
    const parts: string[] = [];
    let cursor = 0;
    for (let i = 0; i < 20; i++) {
      const duration = i < 10 ? 2.0 : 0.3;
      const start = cursor;
      const end = start + duration;
      parts.push(`${i + 1}`, `${fmt(start)} --> ${fmt(end)}`, `This is test sentence number ${i + 1}`, '');
      cursor = end;
    }
    const result = detectCumulativeDrift(parseTranscript(parts.join('\n')));
    if (!result.drifted)
      throw new Error(`Expected drift in accelerating SRT, ratio=${result.ratio.toFixed(2)}`);
    return true;
  });

  if (fs.existsSync(realSrtPath)) {
    const srtContent = fs.readFileSync(realSrtPath, 'utf8');
    const sentences = parseTranscript(srtContent);

    unitCheck(report, '15ab. Real SRT: no cumulative drift', () => {
      const result = detectCumulativeDrift(sentences);
      if (result.drifted)
        throw new Error(`Cumulative drift detected: early avg ${result.earlyAvgWps.toFixed(1)} wps vs late avg ${result.lateAvgWps.toFixed(1)} wps (ratio ${result.ratio.toFixed(2)})`);
      return true;
    });
  }

  // ── Dictation boundary simulation ──────────────────────────────────────────

  console.log('\n─── 15. Dictation Boundary Simulation ───');

  unitCheck(report, '15ac. Boundary: mask pattern matches word structure', () => {
    if (maskPattern('And along the way,') !== '*** ***** *** ***')
      throw new Error(`Expected "*** ***** *** ***", got "${maskPattern('And along the way,')}"`);
    if (maskPattern('Hello, world!') !== '***** *****')
      throw new Error(`Expected "***** *****", got "${maskPattern('Hello, world!')}"`);
    if (maskPattern("it's a test") !== '*** * ****')
      throw new Error(`Expected "*** * ****", got "${maskPattern("it's a test")}"`);
    return true;
  });

  unitCheck(report, '15ad. Boundary: mask preserves word count and lengths', () => {
    const mask = maskPattern('Hello, world! Test.');
    const words = mask.split(' ');
    if (words.length !== 3)
      throw new Error(`Expected 3 masked words, got ${words.length}: "${mask}"`);
    if (words[0].length !== 5)
      throw new Error(`"Hello" should mask to 5 stars, got ${words[0].length}`);
    if (words[1].length !== 5)
      throw new Error(`"world" should mask to 5 stars, got ${words[1].length}`);
    if (words[2].length !== 4)
      throw new Error(`"Test" should mask to 4 stars, got ${words[2].length}`);
    return true;
  });

  unitCheck(report, '15ae. Boundary: seek to start shows correct sentence', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'First sentence here.', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Second sentence here.', '',
      '3', '00:00:04,000 --> 00:00:06,000', 'Third sentence here.',
    ].join('\n');
    const sentences = parseTranscript(srt);
    for (const s of sentences) {
      const active = findActiveSentence(sentences, s.start);
      if (!active || active.id !== s.id)
        throw new Error(`At start of line ${s.id} (t=${s.start}), got line ${active?.id ?? 'none'}`);
    }
    return true;
  });

  unitCheck(report, '15af. Boundary: seek just before end stays on same sentence', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'First.', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Second.',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const justBeforeEnd = sentences[0].end - 0.01;
    const active = findActiveSentence(sentences, justBeforeEnd);
    if (!active || active.id !== 1)
      throw new Error(`At t=${justBeforeEnd} (just before line 1 end), expected line 1, got ${active?.id ?? 'none'}`);
    return true;
  });

  unitCheck(report, '15ag. Boundary: seek to exact end transitions to next', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'First.', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Second.',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const active = findActiveSentence(sentences, sentences[0].end);
    if (!active || active.id !== 2)
      throw new Error(`At exact end of line 1 (t=${sentences[0].end}), expected line 2, got ${active?.id ?? 'none'}`);
    return true;
  });

  if (fs.existsSync(realSrtPath)) {
    const srtContent = fs.readFileSync(realSrtPath, 'utf8');
    const sentences = parseTranscript(srtContent);

    unitCheck(report, '15ah. Real SRT: every sentence start maps to itself', () => {
      const mismatches: string[] = [];
      for (const s of sentences) {
        const active = findActiveSentence(sentences, s.start);
        if (!active || active.id !== s.id) {
          mismatches.push(`Line ${s.id} at t=${s.start.toFixed(3)}s → got line ${active?.id ?? 'none'}`);
        }
      }
      if (mismatches.length > 0)
        throw new Error(`${mismatches.length} mismatches:\n${mismatches.slice(0, 5).join('\n')}`);
      return true;
    });

    unitCheck(report, '15ai. Real SRT: start times are monotonically increasing', () => {
      const violations: string[] = [];
      for (let i = 1; i < sentences.length; i++) {
        if (sentences[i].start < sentences[i - 1].start) {
          violations.push(
            `Line ${sentences[i].id} starts at ${sentences[i].start.toFixed(3)}s before line ${sentences[i - 1].id} at ${sentences[i - 1].start.toFixed(3)}s`
          );
        }
      }
      if (violations.length > 0)
        throw new Error(`${violations.length} out-of-order sentences:\n${violations.slice(0, 5).join('\n')}`);
      return true;
    });

    unitCheck(report, '15aj. Real SRT: no micro-duration multi-word sentences (< 0.3s)', () => {
      const micro = sentences.filter(s => {
        const words = s.text.split(/\s+/).filter(w => w).length;
        return (s.end - s.start) < 0.3 && words > 1;
      });
      if (micro.length > 0)
        throw new Error(`${micro.length} micro-duration multi-word sentences:\n${micro.slice(0, 5).map(s => `Line ${s.id}: ${(s.end - s.start).toFixed(3)}s "${s.text.slice(0, 40)}"`).join('\n')}`);
      return true;
    });

    unitCheck(report, '15ak. Real SRT: mask pattern at line 22 matches expected', () => {
      const line22 = sentences.find(s => s.id === 22);
      if (!line22) throw new Error('Line 22 not found');
      const mask = maskPattern(line22.text);
      if (mask !== '*** ***** *** ***')
        throw new Error(`Line 22 mask "${mask}" does not match expected pattern "*** ***** *** ***"`);
      return true;
    });

    unitCheck(report, '15al. Real SRT: line 22 and 23 have distinct masks', () => {
      const line22 = sentences.find(s => s.id === 22);
      const line23 = sentences.find(s => s.id === 23);
      if (!line22 || !line23) throw new Error('Missing lines 22/23');
      const mask22 = maskPattern(line22.text);
      const mask23 = maskPattern(line23.text);
      if (mask22 === mask23)
        throw new Error(`Lines 22 and 23 have identical mask "${mask22}" — user cannot tell them apart in dictation mode`);
      return true;
    });

    unitCheck(report, '15am. Real SRT: boundary sweep at 0.1s intervals around line 22', () => {
      const line22 = sentences.find(s => s.id === 22)!;
      const errors: string[] = [];
      for (let t = line22.start; t < line22.end; t += 0.1) {
        const active = findActiveSentence(sentences, t);
        if (!active || active.id !== 22)
          errors.push(`t=${t.toFixed(2)}s → line ${active?.id ?? 'none'} (expected 22)`);
      }
      if (errors.length > 0)
        throw new Error(`${errors.length} boundary mismatches:\n${errors.join('\n')}`);
      return true;
    });
  }

  // ── Micro-duration and edge case detection ────────────────────────────────

  console.log('\n─── 15. Edge Cases ───');

  unitCheck(report, '15an. Detection: finds micro-duration sentences', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'Normal length here', '',
      '2', '00:00:02,000 --> 00:00:02,100', 'Tiny', '',
      '3', '00:00:02,100 --> 00:00:04,000', 'Normal again here too',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const micro = sentences.filter(s => (s.end - s.start) < 0.3);
    if (micro.length !== 1 || micro[0].id !== 2)
      throw new Error(`Expected line 2 as micro, got ${micro.map(s => s.id).join(',')}`);
    return true;
  });

  unitCheck(report, '15ao. parseTranscript: IDs match SRT block numbers', () => {
    const srt = [
      '5', '00:00:00,000 --> 00:00:01,000', 'First block.', '',
      '10', '00:00:01,000 --> 00:00:02,000', 'Second block.', '',
      '23', '00:00:02,000 --> 00:00:03,000', 'Third block.',
    ].join('\n');
    const result = parseTranscript(srt);
    if (result[0].id !== 5) throw new Error(`Expected id 5, got ${result[0].id}`);
    if (result[1].id !== 10) throw new Error(`Expected id 10, got ${result[1].id}`);
    if (result[2].id !== 23) throw new Error(`Expected id 23, got ${result[2].id}`);
    return true;
  });

  unitCheck(report, '15ao2. maskPattern: handles Unicode modifier letter U+02BC', () => {
    const withModifier = maskPattern('Switzerlandʼs trains');
    const expected = maskPattern('switzerlands trains');
    if (withModifier !== expected)
      throw new Error(`Modifier letter mask "${withModifier}" differs from plain "${expected}" — maskPattern and normalizeDictationTarget disagree`);
    if (withModifier !== '************ ******')
      throw new Error(`Expected "************ ******", got "${withModifier}"`);
    return true;
  });

  if (fs.existsSync(realSrtPath)) {
    const srtContent = fs.readFileSync(realSrtPath, 'utf8');
    const sentences = parseTranscript(srtContent);

    unitCheck(report, '15ao3. Real SRT: last sentence ends within audio duration', () => {
      const last = sentences[sentences.length - 1];
      // Audio is 43:05 = 2585 seconds
      if (last.end > 2590)
        throw new Error(`Last sentence ends at ${last.end.toFixed(1)}s, exceeds audio duration (~2585s)`);
      const duration = last.end - last.start;
      if (duration <= 0) throw new Error(`Last sentence has invalid duration: ${duration.toFixed(3)}s`);
      if (duration > 30) throw new Error(`Last sentence duration ${duration.toFixed(1)}s is suspiciously long`);
      return true;
    });

    unitCheck(report, '15ao4. Real SRT: IDs are sequential 1..N', () => {
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].id !== i + 1)
          throw new Error(`Sentence at index ${i} has id ${sentences[i].id}, expected ${i + 1}`);
      }
      return true;
    });
  }

  unitCheck(report, '15ap. Matching: rapid seek across multiple boundaries', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'B', '',
      '3', '00:00:02,000 --> 00:00:03,000', 'C', '',
      '4', '00:00:03,000 --> 00:00:04,000', 'D', '',
      '5', '00:00:04,000 --> 00:00:05,000', 'E',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const seekSequence = [0, 4.5, 1.0, 3.5, 0.5, 2.5, 4.9];
    const expected =     [1,   5,   2,   4,   1,   3,   5];
    for (let i = 0; i < seekSequence.length; i++) {
      const active = findActiveSentence(sentences, seekSequence[i]);
      if (!active || active.id !== expected[i])
        throw new Error(`Seek to ${seekSequence[i]}s: expected line ${expected[i]}, got ${active?.id ?? 'none'}`);
    }
    return true;
  });
}

// ── Standalone runner ────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('15-srt-validation.ts') || process.argv[1]?.endsWith('15-srt-validation.js')) {
  const report: ReportEntry[] = [];
  run(null, report).then(() => {
    const passed = report.filter((r) => r.passed).length;
    const failed = report.filter((r) => !r.passed).length;
    console.log(`\n═══ SRT validation: ${passed} passed, ${failed} failed ═══\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
