// Own tracks get a gain at upload, so they sound as loud as the default tracks
// (those are normalized with ffmpeg; see scripts/upload-bgm.sh).

/** RMS of the default tracks after normalizing, measured with ffmpeg astats. */
export const TARGET_RMS_DB = -21;
const MIN_GAIN = 0.25;
const MAX_GAIN = 4;
/** Boosting must not push the loudest sample past this. */
const PEAK_LIMIT = 0.95;

export type Level = { rmsDb: number; peak: number };

/** RMS (in dBFS) and peak of decoded audio, all channels together. */
export function measureLevel(channels: readonly Float32Array[]): Level {
  let sum = 0;
  let count = 0;
  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    count += data.length;
  }
  if (count === 0 || sum === 0) return { rmsDb: -Infinity, peak };
  return { rmsDb: 10 * Math.log10(sum / count), peak };
}

/** Playback gain that brings a track to TARGET_RMS_DB without clipping. 1 for silence. */
export function normalizeGain({ rmsDb, peak }: Level): number {
  if (!Number.isFinite(rmsDb)) return 1;
  let gain = 10 ** ((TARGET_RMS_DB - rmsDb) / 20);
  if (gain > 1 && peak > 0) gain = Math.min(gain, Math.max(1, PEAK_LIMIT / peak));
  gain = Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain));
  return Math.round(gain * 1000) / 1000;
}

/** "Lo-Fi_Rain (Official Audio).mp3" -> "lo fi rain". Lowercase and short, like the defaults. */
export function trackNameFromFile(fileName: string): string {
  const name = fileName
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return (name || 'my track').slice(0, 40).trim();
}
