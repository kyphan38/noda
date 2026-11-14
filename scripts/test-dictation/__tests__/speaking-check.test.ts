import { describe, it, expect } from 'vitest';
import {
  bandFor,
  normalizeSpeakingAssessment,
  overallScore,
  paceScore,
  scoreParts,
  SpeakingShapeError,
} from '../../../functions/src/lib/speakingScore';
import { wavStats } from '../../../functions/src/lib/wavStats';
import { buildSpeakingSegments } from '../../../lib/speakingSegments';
import type { Sentence } from '../../../types';

const EM_DASH = String.fromCharCode(0x2014);
const criteria5 = { clarity: 5, stress: 5, intonation: 5 };

describe('speaking score', () => {
  it('a clean reading scores 100', () => {
    const parts = scoreParts({
      wordCount: 40,
      issues: [],
      checks: [{ id: 0, result: 'yes' }],
      criteria: criteria5,
      learnerSeconds: 10,
      referenceSeconds: 10,
    });
    expect(overallScore(parts)).toBe(100);
    expect(bandFor(100)).toBe('great');
  });

  it('the same labels always give the same score', () => {
    const input = {
      wordCount: 30,
      issues: [
        { index: 2, kind: 'missing' as const, heard: '', tip: '' },
        { index: 7, kind: 'mispronounced' as const, heard: 'sink', tip: '' },
      ],
      checks: [
        { id: 0, result: 'partly' as const },
        { id: 1, result: 'no' as const },
      ],
      criteria: { clarity: 4, stress: 3, intonation: 3 },
      learnerSeconds: 12,
      referenceSeconds: 10,
    };
    const a = overallScore(scoreParts(input));
    const b = overallScore(scoreParts(input));
    expect(a).toBe(b);
    // words 1 - 1.6/30, sounds 0.25, delivery (10/3-1)/4, pace 1
    expect(a).toBe(71);
  });

  it('a missing word costs more than a mispronounced one', () => {
    const base = { wordCount: 10, checks: [], criteria: criteria5, learnerSeconds: 5, referenceSeconds: 5 };
    const missing = scoreParts({ ...base, issues: [{ index: 0, kind: 'missing', heard: '', tip: '' }] });
    const wrong = scoreParts({ ...base, issues: [{ index: 0, kind: 'mispronounced', heard: 'x', tip: '' }] });
    expect(missing.words).toBeLessThan(wrong.words);
  });

  it('without a checklist the sounds part is left out, not counted as zero', () => {
    const parts = scoreParts({
      wordCount: 10,
      issues: [],
      checks: [],
      criteria: criteria5,
      learnerSeconds: 5,
      referenceSeconds: 5,
    });
    expect(parts.sounds).toBeNull();
    expect(overallScore(parts)).toBe(100);
  });

  it('pace: shadowing a bit slower is fine, far off is not', () => {
    expect(paceScore(11, 10)).toBe(1);
    expect(paceScore(8.5, 10)).toBe(1);
    expect(paceScore(20, 10)).toBe(0);
    expect(paceScore(5, 10)).toBe(0);
    expect(paceScore(16.5, 10)).toBeCloseTo(0.5, 5);
    expect(paceScore(0, 10)).toBe(0);
  });

  it('bands', () => {
    expect(bandFor(85)).toBe('great');
    expect(bandFor(84)).toBe('good');
    expect(bandFor(65)).toBe('good');
    expect(bandFor(64)).toBe('practice');
  });
});

describe('normalizeSpeakingAssessment', () => {
  it('drops out-of-range and duplicate word issues, keeps order', () => {
    const r = normalizeSpeakingAssessment(
      {
        wordIssues: [
          { index: 5, kind: 'missing', heard: 'x', tip: 'say it' },
          { index: 1, kind: 'mispronounced', heard: 'sink', tip: 'tongue out' },
          { index: 1, kind: 'missing', heard: '', tip: '' },
          { index: 99, kind: 'missing', heard: '', tip: '' },
          { index: 2, kind: 'weird', heard: '', tip: '' },
        ],
        checks: [],
        criteria: criteria5,
        fixes: [],
      },
      10,
      0
    );
    expect(r.issues.map((i) => i.index)).toEqual([1, 5]);
    expect(r.issues[1].heard).toBe(''); // missing words carry no "heard"
  });

  it('fills a check Gemini skipped with "no" and ignores unknown ids', () => {
    const r = normalizeSpeakingAssessment(
      { wordIssues: [], checks: [{ id: 1, result: 'yes' }, { id: 7, result: 'yes' }], criteria: criteria5, fixes: [] },
      5,
      3
    );
    expect(r.checks).toEqual([
      { id: 0, result: 'no' },
      { id: 1, result: 'yes' },
      { id: 2, result: 'no' },
    ]);
  });

  it('clamps criteria to 1-5 and caps fixes at 3', () => {
    const r = normalizeSpeakingAssessment(
      {
        wordIssues: [],
        checks: [],
        criteria: { clarity: 9, stress: 0, intonation: 3.4 },
        fixes: [1, 2, 3, 4].map((n) => ({ text: `w${n}`, why: `do ${n} ${EM_DASH} now` })),
      },
      5,
      0
    );
    expect(r.criteria).toEqual({ clarity: 5, stress: 1, intonation: 3 });
    expect(r.fixes).toHaveLength(3);
    expect(r.fixes[0].why).not.toContain(EM_DASH);
  });

  it('throws on a reply without criteria', () => {
    expect(() => normalizeSpeakingAssessment({ wordIssues: [] }, 5, 0)).toThrow(SpeakingShapeError);
  });
});

function makeWav(samples: number[]): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(v * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe('wavStats', () => {
  it('speech length skips silence before and after', () => {
    const silence = (s: number) => new Array(16000 * s).fill(0);
    const tone = (s: number) => Array.from({ length: 16000 * s }, (_, i) => 0.3 * Math.sin(i / 5));
    const stats = wavStats(makeWav([...silence(1), ...tone(2), ...silence(1)]));
    expect(stats.seconds).toBe(4);
    expect(stats.speechSeconds).toBeCloseTo(2, 1);
  });

  it('digital silence has no speech', () => {
    const stats = wavStats(makeWav(new Array(16000).fill(0)));
    expect(stats.speechSeconds).toBe(0);
    expect(stats.dbfs).toBe(-Infinity);
  });
});

const sentence = (id: number, words: number, start: number): Sentence => ({
  id,
  text: Array.from({ length: words }, (_, i) => `w${id}_${i}`).join(' '),
  start,
  end: start + words * 0.4,
});

describe('buildSpeakingSegments', () => {
  it('groups sentences into 30-50 word segments, cutting at sentence ends', () => {
    const t = [sentence(1, 12, 0), sentence(2, 12, 5), sentence(3, 12, 10), sentence(4, 20, 15), sentence(5, 15, 25), sentence(6, 18, 32)];
    const segs = buildSpeakingSegments(t);
    expect(segs.map((s) => s.id)).toEqual(['1-3', '4-5', '6-6']);
    expect(segs.map((s) => s.wordCount)).toEqual([36, 35, 18]);
    expect(segs[0].start).toBe(0);
    expect(segs[0].end).toBe(t[2].end);
  });

  it('closes early rather than going past the max', () => {
    const segs = buildSpeakingSegments([sentence(1, 25, 0), sentence(2, 30, 10)]);
    expect(segs.map((s) => s.wordCount)).toEqual([25, 30]);
  });

  it('a very long sentence is a segment of its own', () => {
    const segs = buildSpeakingSegments([sentence(1, 5, 0), sentence(2, 70, 3)]);
    expect(segs.map((s) => s.id)).toEqual(['1-1', '2-2']);
  });

  it('a short leftover at the end joins the segment before it', () => {
    const segs = buildSpeakingSegments([sentence(1, 32, 0), sentence(2, 6, 14)]);
    expect(segs.map((s) => s.id)).toEqual(['1-2']);
  });

  it('skips empty sentences and handles an empty transcript', () => {
    expect(buildSpeakingSegments([])).toEqual([]);
    const segs = buildSpeakingSegments([{ id: 1, text: '  ', start: 0, end: 1 }, sentence(2, 5, 1)]);
    expect(segs.map((s) => s.id)).toEqual(['2-2']);
  });
});
