import { normalizeDictationTarget } from '../../../lib/utils';
import type { Sentence } from '../../../types';

export interface TimingIssue {
  lineId: number;
  type: 'overlap' | 'negative-duration' | 'speaking-rate-high' | 'speaking-rate-low';
  message: string;
}

export function findTimingIssues(sentences: Sentence[]): TimingIssue[] {
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
        message: `Line ${s.id}: ${wps.toFixed(1)} words/sec (${words} words in ${duration.toFixed(2)}s) - exceeds 9 wps threshold`,
      });
    }

    if (wps < 0.8 && words > 2) {
      issues.push({
        lineId: s.id,
        type: 'speaking-rate-low',
        message: `Line ${s.id}: ${wps.toFixed(1)} words/sec (${words} words in ${duration.toFixed(2)}s) - below 0.8 wps threshold`,
      });
    }
  }

  return issues;
}

export function findActiveSentence(sentences: Sentence[], time: number): Sentence | undefined {
  return sentences.find(s => time >= s.start && time < s.end);
}

export function wordsPerSec(s: Sentence): number {
  const d = s.end - s.start;
  if (d <= 0) return 0;
  return s.text.split(/\s+/).filter(w => w).length / d;
}

export interface RelativeAnomaly {
  lineId: number;
  wps: number;
  neighborAvgWps: number;
  ratio: number;
  message: string;
}

export function findRelativeTimingAnomalies(
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
        message: `Line ${s.id}: ${wps.toFixed(1)} wps vs neighbor avg ${avgNeighbor.toFixed(1)} wps (${Math.max(ratio, invRatio).toFixed(1)}x ${ratio >= ratioThreshold ? 'faster' : 'slower'}) - "${s.text.slice(0, 50)}"`,
      });
    }
  }
  return anomalies;
}

export interface DriftResult {
  earlyAvgWps: number;
  lateAvgWps: number;
  ratio: number;
  drifted: boolean;
}

export function detectCumulativeDrift(
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

export function maskPattern(text: string): string {
  const norm = normalizeDictationTarget(text);
  return norm.split(' ').map(w => '*'.repeat(w.length)).join(' ');
}
