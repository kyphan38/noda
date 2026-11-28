import { describe, expect, it } from 'vitest';

import { measureLevel, normalizeGain, TARGET_RMS_DB, trackNameFromFile } from './loudness';

function sine(amp: number, n = 4800): Float32Array {
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = amp * Math.sin((2 * Math.PI * i) / 48);
  return d;
}

describe('measureLevel', () => {
  it('measures a sine wave: RMS is amp / sqrt(2)', () => {
    const { rmsDb, peak } = measureLevel([sine(0.5), sine(0.5)]);
    expect(rmsDb).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 1);
    expect(peak).toBeCloseTo(0.5, 2);
  });

  it('reports silence as -Infinity', () => {
    expect(measureLevel([new Float32Array(10)]).rmsDb).toBe(-Infinity);
    expect(measureLevel([]).rmsDb).toBe(-Infinity);
  });
});

describe('normalizeGain', () => {
  it('turns a loud track down to the target', () => {
    const g = normalizeGain({ rmsDb: TARGET_RMS_DB + 6, peak: 1 });
    expect(g).toBeCloseTo(0.501, 2);
  });

  it('turns a quiet track up, but never past clipping', () => {
    expect(normalizeGain({ rmsDb: TARGET_RMS_DB - 6, peak: 0.2 })).toBeCloseTo(1.995, 2);
    expect(normalizeGain({ rmsDb: TARGET_RMS_DB - 6, peak: 0.8 })).toBeCloseTo(1.188, 2);
  });

  it('stays inside 0.25..4 and is 1 for silence', () => {
    expect(normalizeGain({ rmsDb: 0, peak: 1 })).toBe(0.25);
    expect(normalizeGain({ rmsDb: -60, peak: 0.01 })).toBe(4);
    expect(normalizeGain({ rmsDb: -Infinity, peak: 0 })).toBe(1);
  });
});

describe('trackNameFromFile', () => {
  it('makes a short lowercase name', () => {
    expect(trackNameFromFile('Lo-Fi_Rain (Official Audio).mp3')).toBe('lo fi rain');
    expect(trackNameFromFile('Solas_5UzKfjTl9ns.m4a')).toBe('solas 5uzkfjtl9ns');
  });

  it('keeps non-Latin letters', () => {
    expect(trackNameFromFile('너를 닮은 향기.mp3')).toBe('너를 닮은 향기');
  });

  it('falls back when nothing is left', () => {
    expect(trackNameFromFile('___.mp3')).toBe('my track');
  });

  it('cuts long names', () => {
    expect(trackNameFromFile(`${'a'.repeat(60)}.mp3`).length).toBe(40);
  });
});
