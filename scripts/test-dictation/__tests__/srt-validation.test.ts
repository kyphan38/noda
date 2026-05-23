import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseTranscript } from '../../../lib/utils';
import type { Sentence } from '../../../types';
import {
  findTimingIssues,
  findActiveSentence,
  findRelativeTimingAnomalies,
  detectCumulativeDrift,
  maskPattern,
} from './srt-helpers';

const realSrtPath = path.join(
  process.cwd(),
  'audio/How_Switzerland_Engineered_the_Perfect_Country_OMbV1rIPhCg.srt',
);
const hasRealSrt = fs.existsSync(realSrtPath);

describe('parseTranscript', () => {
  it('15a. correct timestamp conversion', () => {
    const srt = [
      '1', '00:00:06,840 --> 00:00:11,750', 'Hello world.', '',
      '2', '00:01:18,700 --> 00:01:19,760', 'And along the way,',
    ].join('\n');
    const result = parseTranscript(srt);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBeCloseTo(6.84, 2);
    expect(result[0].end).toBeCloseTo(11.75, 2);
    expect(result[1].start).toBeCloseTo(78.7, 2);
    expect(result[1].end).toBeCloseTo(79.76, 2);
  });

  it('15b. preserves text content', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'Hello, world!', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'Line two.',
    ].join('\n');
    const result = parseTranscript(srt);
    expect(result[0].text).toBe('Hello, world!');
    expect(result[1].text).toBe('Line two.');
  });

  it('15c. handles empty input', () => {
    expect(parseTranscript('')).toHaveLength(0);
  });

  it('15d. handles multi-line subtitle text', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'Line one', 'continues here.',
    ].join('\n');
    const result = parseTranscript(srt);
    expect(result[0].text).toBe('Line one\ncontinues here.');
  });

  it('15d2. skips malformed/truncated blocks', () => {
    const srt1 = ['1', 'No timestamp here', 'Hello.', '', '2', '00:00:01,000 --> 00:00:02,000', 'Valid.'].join('\n');
    const r1 = parseTranscript(srt1);
    expect(r1).toHaveLength(1);
    expect(r1[0].text).toBe('Valid.');

    const srt2 = ['1', '00:00:00,000 --> 00:00:01,000', 'Good.', '', '2'].join('\n');
    expect(parseTranscript(srt2)).toHaveLength(1);

    const srt3 = ['1', '00:00:00,000 --> 00:00:01,000', '', '', '2', '00:00:01,000 --> 00:00:02,000', 'OK.'].join('\n');
    const withText = parseTranscript(srt3).filter(s => s.text.trim().length > 0);
    expect(withText.length).toBeGreaterThanOrEqual(1);
  });

  it('15e. handles Windows line endings', () => {
    const srt = '1\r\n00:00:00,000 --> 00:00:01,000\r\nHello.\r\n\r\n2\r\n00:00:01,000 --> 00:00:02,000\r\nWorld.';
    expect(parseTranscript(srt)).toHaveLength(2);
  });
});

describe('sentence matching', () => {
  it('15f. overlapping SRT produces multiple matches with filter', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:03,000', 'B',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const atOverlap = sentences.filter(s => 1.5 >= s.start && 1.5 < s.end);
    expect(atOverlap).toHaveLength(2);
    const first = findActiveSentence(sentences, 1.5);
    expect(first?.id).toBe(1);
  });

  it('15f2. non-overlapping SRT has at most one active', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'B', '',
      '3', '00:00:02,500 --> 00:00:03,500', 'C',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const testTimes = [0, 0.5, 0.999, 1.0, 1.5, 1.999, 2.0, 2.25, 2.5, 3.0, 3.499, 3.5, 4.0];
    for (const t of testTimes) {
      const active = sentences.filter(s => t >= s.start && t < s.end);
      expect(active.length).toBeLessThanOrEqual(1);
    }
  });

  it('15g. exclusive upper bound (end time activates next)', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'B',
    ].join('\n');
    const sentences = parseTranscript(srt);
    expect(findActiveSentence(sentences, 1.0)?.id).toBe(2);
  });

  it('15h. gap between sentences returns no active', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:02,000 --> 00:00:03,000', 'B',
    ].join('\n');
    const sentences = parseTranscript(srt);
    expect(findActiveSentence(sentences, 1.5)).toBeUndefined();
  });
});

describe('timing quality detection', () => {
  it('15i. finds overlapping timestamps', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,500', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,500', 'B',
    ].join('\n');
    const overlaps = findTimingIssues(parseTranscript(srt)).filter(i => i.type === 'overlap');
    expect(overlaps).toHaveLength(1);
  });

  it('15j. finds negative durations', () => {
    const srt = ['1', '00:00:02,000 --> 00:00:01,000', 'Backwards'].join('\n');
    const negatives = findTimingIssues(parseTranscript(srt)).filter(i => i.type === 'negative-duration');
    expect(negatives).toHaveLength(1);
  });

  it('15k. flags impossible speaking rate', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:00,500',
      'This is way too many words to say in half a second obviously',
    ].join('\n');
    const rateIssues = findTimingIssues(parseTranscript(srt)).filter(i => i.type === 'speaking-rate-high');
    expect(rateIssues).toHaveLength(1);
  });

  it('15k2. flags low speaking rate (< 0.8 wps)', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:05,500',
      'Only three words here',
    ].join('\n');
    const rateIssues = findTimingIssues(parseTranscript(srt)).filter(i => i.type === 'speaking-rate-low');
    expect(rateIssues).toHaveLength(1);
  });

  it('15k3. normal speaking rate (>= 0.8 wps) not flagged', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:04,000',
      'These four words pass easily',
    ].join('\n');
    const rateIssues = findTimingIssues(parseTranscript(srt)).filter(i => i.type === 'speaking-rate-low');
    expect(rateIssues).toHaveLength(0);
  });

  it('15l. clean SRT has no issues', () => {
    const srtPath = path.join(process.cwd(), 'scripts', 'fixtures', 'test-lesson.srt');
    const srt = fs.readFileSync(srtPath, 'utf8');
    const issues = findTimingIssues(parseTranscript(srt));
    expect(issues).toHaveLength(0);
  });

  it('15s2. low-rate check skips 2-word sentences (words > 2 guard)', () => {
    const srt = ['1', '00:00:00,000 --> 00:00:10,000', 'Thank you'].join('\n');
    const lowRate = findTimingIssues(parseTranscript(srt)).filter(i => i.type === 'speaking-rate-low');
    expect(lowRate).toHaveLength(0);

    const srt2 = ['1', '00:00:00,000 --> 00:00:11,000', 'Thank you kindly'].join('\n');
    const lowRate2 = findTimingIssues(parseTranscript(srt2)).filter(i => i.type === 'speaking-rate-low');
    expect(lowRate2).toHaveLength(1);
  });
});

describe.skipIf(!hasRealSrt)('real SRT validation', () => {
  let sentences: Sentence[];

  beforeAll(() => {
    const srtContent = fs.readFileSync(realSrtPath, 'utf8');
    sentences = parseTranscript(srtContent);
  });

  it('15m. parses all 829 sentences', () => {
    expect(sentences).toHaveLength(829);
  });

  it('15n. no negative durations', () => {
    const bad = sentences.filter(s => s.end <= s.start);
    expect(bad).toHaveLength(0);
  });

  it('15o. no overlapping timestamps', () => {
    const issues = findTimingIssues(sentences).filter(i => i.type === 'overlap');
    expect(issues).toHaveLength(0);
  });

  it('15p. speaking rate within bounds (allowing stable-ts alignment artifacts)', () => {
    const knownAlignmentArtifacts = new Set([669, 827]);
    const issues = findTimingIssues(sentences).filter(
      i => (i.type === 'speaking-rate-high' || i.type === 'speaking-rate-low')
        && !knownAlignmentArtifacts.has(i.lineId),
    );
    expect(issues).toHaveLength(0);
  });

  it('15q. line 22: timestamp and text match expected', () => {
    const line22 = sentences.find(s => s.id === 22);
    expect(line22).toBeDefined();
    expect(line22!.start).toBeCloseTo(78.64, 1);
    expect(line22!.end).toBeCloseTo(79.74, 1);
    expect(line22!.text).toBe('And along the way,');
  });

  it('15r. at t=79.0s sentence matching returns line 22', () => {
    const active = findActiveSentence(sentences, 79.0);
    expect(active?.id).toBe(22);
  });

  it('15s. line 22: speaking rate within normal range', () => {
    const line22 = sentences.find(s => s.id === 22)!;
    const duration = line22.end - line22.start;
    const words = line22.text.split(/\s+/).filter(w => w).length;
    const wps = words / duration;
    expect(wps).toBeGreaterThanOrEqual(0.8);
    const rateIssues = findTimingIssues([line22]).filter(i => i.type === 'speaking-rate-low');
    expect(rateIssues).toHaveLength(0);
  });

  it('15t. lines 21-24: continuous timeline (no large gaps)', () => {
    const line21 = sentences.find(s => s.id === 21)!;
    const line22 = sentences.find(s => s.id === 22)!;
    const line23 = sentences.find(s => s.id === 23)!;
    const line24 = sentences.find(s => s.id === 24)!;
    expect(line22.start - line21.end).toBeLessThanOrEqual(9.0);
    expect(line23.start - line22.end).toBeLessThanOrEqual(0.5);
    expect(line24.start - line23.end).toBeLessThanOrEqual(0.5);
  });

  it('15x. relative anomalies count is low', () => {
    const anomalies = findRelativeTimingAnomalies(sentences);
    const threshold = Math.ceil(sentences.length * 0.04);
    expect(anomalies.length).toBeLessThanOrEqual(threshold);
  });

  it('15y. lines 20-26: no unexpected relative anomalies', () => {
    const nearby = sentences.filter(s => s.id >= 20 && s.id <= 26);
    const anomalies = findRelativeTimingAnomalies(nearby);
    expect(anomalies).toHaveLength(0);
  });

  it('15ab. no cumulative drift', () => {
    const result = detectCumulativeDrift(sentences);
    expect(result.drifted).toBe(false);
  });

  it('15ah. every sentence start maps to itself', () => {
    const mismatches: string[] = [];
    for (const s of sentences) {
      const active = findActiveSentence(sentences, s.start);
      if (!active || active.id !== s.id) {
        mismatches.push(`Line ${s.id} at t=${s.start.toFixed(3)}s → got line ${active?.id ?? 'none'}`);
      }
    }
    expect(mismatches).toHaveLength(0);
  });

  it('15ai. start times are monotonically increasing', () => {
    const violations: string[] = [];
    for (let i = 1; i < sentences.length; i++) {
      if (sentences[i].start < sentences[i - 1].start) {
        violations.push(
          `Line ${sentences[i].id} starts at ${sentences[i].start.toFixed(3)}s before line ${sentences[i - 1].id}`,
        );
      }
    }
    expect(violations).toHaveLength(0);
  });

  it('15aj. no unexpected micro-duration multi-word sentences (< 0.3s)', () => {
    const knownQuickExclamations = new Set([600, 669, 827]);
    const micro = sentences.filter(s => {
      const words = s.text.split(/\s+/).filter(w => w).length;
      return (s.end - s.start) < 0.3 && words > 1 && !knownQuickExclamations.has(s.id);
    });
    expect(micro).toHaveLength(0);
  });

  it('15ak. mask pattern at line 22 matches expected', () => {
    const line22 = sentences.find(s => s.id === 22)!;
    expect(maskPattern(line22.text)).toBe('*** ***** *** ***');
  });

  it('15al. line 22 and 23 have distinct masks', () => {
    const line22 = sentences.find(s => s.id === 22)!;
    const line23 = sentences.find(s => s.id === 23)!;
    expect(maskPattern(line22.text)).not.toBe(maskPattern(line23.text));
  });

  it('15am. boundary sweep at 0.1s intervals around line 22', () => {
    const line22 = sentences.find(s => s.id === 22)!;
    const errors: string[] = [];
    for (let t = line22.start; t < line22.end; t += 0.1) {
      const active = findActiveSentence(sentences, t);
      if (!active || active.id !== 22) {
        errors.push(`t=${t.toFixed(2)}s → line ${active?.id ?? 'none'} (expected 22)`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  it('15ao3. last sentence ends within audio duration', () => {
    const last = sentences[sentences.length - 1];
    expect(last.end).toBeLessThanOrEqual(2590);
    expect(last.end - last.start).toBeGreaterThan(0);
    expect(last.end - last.start).toBeLessThanOrEqual(30);
  });

  it('15ao4. IDs are sequential 1..N', () => {
    for (let i = 0; i < sentences.length; i++) {
      expect(sentences[i].id).toBe(i + 1);
    }
  });

  it('15av. total word count above safe threshold', () => {
    const totalWords = sentences.reduce(
      (sum, s) => sum + s.text.split(/\s+/).filter(w => w).length,
      0,
    );
    expect(totalWords).toBeGreaterThanOrEqual(5900);
  });
});

describe('relative timing anomalies', () => {
  it('15u. finds outlier among neighbors', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'This is a normal sentence here', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Another normal speed sentence too', '',
      '3', '00:00:04,000 --> 00:00:04,300', 'Way too many words crammed into this tiny window really fast now', '',
      '4', '00:00:04,300 --> 00:00:06,300', 'Back to a normal speaking rate again', '',
      '5', '00:00:06,300 --> 00:00:08,300', 'And another perfectly normal sentence',
    ].join('\n');
    const anomalies = findRelativeTimingAnomalies(parseTranscript(srt));
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some(a => a.lineId === 3)).toBe(true);
  });

  it('15v. consistent-rate SRT has no anomalies', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'Five words in this sentence', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Also five words right here', '',
      '3', '00:00:04,000 --> 00:00:06,000', 'Still five words per line', '',
      '4', '00:00:06,000 --> 00:00:08,000', 'Keeping the same word count', '',
      '5', '00:00:08,000 --> 00:00:10,000', 'Final five words to check',
    ].join('\n');
    expect(findRelativeTimingAnomalies(parseTranscript(srt))).toHaveLength(0);
  });

  it('15w. slow outlier among fast neighbors', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'Quick words from the speaker', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'Another fast sentence here ok', '',
      '3', '00:00:02,000 --> 00:00:10,000', 'A slow drawn out sentence here', '',
      '4', '00:00:10,000 --> 00:00:11,000', 'More quick words from the person', '',
      '5', '00:00:11,000 --> 00:00:12,000', 'Final fast sentence right here',
    ].join('\n');
    const anomalies = findRelativeTimingAnomalies(parseTranscript(srt));
    expect(anomalies.some(a => a.lineId === 3)).toBe(true);
  });
});

describe('cumulative drift', () => {
  it('15z. uniform SRT has no drift', () => {
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push(`${i + 1}`, `00:00:${String(i * 2).padStart(2, '0')},000 --> 00:00:${String(i * 2 + 1).padStart(2, '0')},800`, `Sentence number ${i + 1} is here`, '');
    }
    const result = detectCumulativeDrift(parseTranscript(lines.join('\n')));
    expect(result.drifted).toBe(false);
  });

  it('15aa. catches accelerating SRT', () => {
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
    expect(result.drifted).toBe(true);
  });
});

describe('dictation boundary simulation', () => {
  it('15ac. mask pattern matches word structure', () => {
    expect(maskPattern('And along the way,')).toBe('*** ***** *** ***');
    expect(maskPattern('Hello, world!')).toBe('***** *****');
    expect(maskPattern("it's a test")).toBe('*** * ****');
  });

  it('15ad. mask preserves word count and lengths', () => {
    const mask = maskPattern('Hello, world! Test.');
    const words = mask.split(' ');
    expect(words).toHaveLength(3);
    expect(words[0]).toHaveLength(5);
    expect(words[1]).toHaveLength(5);
    expect(words[2]).toHaveLength(4);
  });

  it('15ae. seek to start shows correct sentence', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'First sentence here.', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Second sentence here.', '',
      '3', '00:00:04,000 --> 00:00:06,000', 'Third sentence here.',
    ].join('\n');
    const sentences = parseTranscript(srt);
    for (const s of sentences) {
      const active = findActiveSentence(sentences, s.start);
      expect(active?.id).toBe(s.id);
    }
  });

  it('15af. seek just before end stays on same sentence', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'First.', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Second.',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const justBeforeEnd = sentences[0].end - 0.01;
    expect(findActiveSentence(sentences, justBeforeEnd)?.id).toBe(1);
  });

  it('15ag. seek to exact end transitions to next', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'First.', '',
      '2', '00:00:02,000 --> 00:00:04,000', 'Second.',
    ].join('\n');
    const sentences = parseTranscript(srt);
    expect(findActiveSentence(sentences, sentences[0].end)?.id).toBe(2);
  });

  it('15ap. rapid seek across multiple boundaries', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:01,000', 'A', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'B', '',
      '3', '00:00:02,000 --> 00:00:03,000', 'C', '',
      '4', '00:00:03,000 --> 00:00:04,000', 'D', '',
      '5', '00:00:04,000 --> 00:00:05,000', 'E',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const seekSequence = [0, 4.5, 1.0, 3.5, 0.5, 2.5, 4.9];
    const expected = [1, 5, 2, 4, 1, 3, 5];
    for (let i = 0; i < seekSequence.length; i++) {
      const active = findActiveSentence(sentences, seekSequence[i]);
      expect(active?.id).toBe(expected[i]);
    }
  });
});

describe('edge cases', () => {
  it('15an. finds micro-duration sentences', () => {
    const srt = [
      '1', '00:00:00,000 --> 00:00:02,000', 'Normal length here', '',
      '2', '00:00:02,000 --> 00:00:02,100', 'Tiny', '',
      '3', '00:00:02,100 --> 00:00:04,000', 'Normal again here too',
    ].join('\n');
    const sentences = parseTranscript(srt);
    const micro = sentences.filter(s => (s.end - s.start) < 0.3);
    expect(micro).toHaveLength(1);
    expect(micro[0].id).toBe(2);
  });

  it('15ao. IDs match SRT block numbers', () => {
    const srt = [
      '5', '00:00:00,000 --> 00:00:01,000', 'First block.', '',
      '10', '00:00:01,000 --> 00:00:02,000', 'Second block.', '',
      '23', '00:00:02,000 --> 00:00:03,000', 'Third block.',
    ].join('\n');
    const result = parseTranscript(srt);
    expect(result[0].id).toBe(5);
    expect(result[1].id).toBe(10);
    expect(result[2].id).toBe(23);
  });

  it('15ao2. maskPattern handles Unicode modifier letter U+02BC', () => {
    const withModifier = maskPattern('Switzerlandʼs trains');
    const expected = maskPattern('switzerlands trains');
    expect(withModifier).toBe(expected);
    expect(withModifier).toBe('************ ******');
  });
});

describe('word-presence regression', () => {
  const excerptPath = path.join(process.cwd(), 'scripts', 'fixtures', 'switzerland-excerpt.srt');
  const excerptContent = fs.readFileSync(excerptPath, 'utf8');
  const excerptSentences = parseTranscript(excerptContent);
  const excerptText = excerptSentences.map(s => s.text).join('\n');

  it('15aq. previously-dropped short words are present', () => {
    const required = [
      'A few months ago',
      'I asked the people',
      "I'm an American who",
      "how it's designed",
      'my first item of business',
    ];
    const missing = required.filter(phrase => !excerptText.includes(phrase));
    expect(missing).toHaveLength(0);
  });

  it('15ar. no negative durations', () => {
    const bad = excerptSentences.filter(s => s.end < s.start);
    expect(bad).toHaveLength(0);
  });

  it('15as. no overlapping timestamps', () => {
    const issues = findTimingIssues(excerptSentences).filter(i => i.type === 'overlap');
    expect(issues).toHaveLength(0);
  });

  it('15at. start times are monotonically increasing', () => {
    const violations: string[] = [];
    for (let i = 1; i < excerptSentences.length; i++) {
      if (excerptSentences[i].start < excerptSentences[i - 1].start) {
        violations.push(`Line ${excerptSentences[i].id} starts before line ${excerptSentences[i - 1].id}`);
      }
    }
    expect(violations).toHaveLength(0);
  });

  it('15au. IDs are sequential 1..N', () => {
    for (let i = 0; i < excerptSentences.length; i++) {
      expect(excerptSentences[i].id).toBe(i + 1);
    }
  });
});
