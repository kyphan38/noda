/**
 * Length and loudness of a mono 16kHz 16-bit WAV (what sliceAudioClip and
 * convertToWav write). No imports, so the app's vitest suite can load it.
 */

const SAMPLE_RATE = 16000;
const BYTES_PER_SEC = SAMPLE_RATE * 2;
/** 20 ms frames for finding where speech starts and stops. */
const FRAME_SAMPLES = SAMPLE_RATE / 50;
/** A frame louder than this counts as speech; room noise sits well below it. */
const SPEECH_FRAME_DBFS = -45;

export interface WavStats {
  bytes: number;
  seconds: number;
  /** RMS of the whole clip in dBFS; -Infinity for digital silence. */
  dbfs: number;
  /** From the first to the last speech frame, so silence before and after is not counted. */
  speechSeconds: number;
}

export function wavStats(wav: Buffer): WavStats {
  // ffmpeg adds a LIST chunk, so find the PCM by its "data" chunk, not a fixed offset.
  const dataAt = wav.indexOf("data", 12, "ascii");
  const start = dataAt >= 0 ? dataAt + 8 : wav.length;
  const samples = Math.max(0, Math.floor((wav.length - start) / 2));

  let sumSquares = 0;
  let firstSpeech = -1;
  let lastSpeech = -1;
  for (let f = 0; f * FRAME_SAMPLES < samples; f++) {
    let frameSum = 0;
    const end = Math.min(samples, (f + 1) * FRAME_SAMPLES);
    for (let i = f * FRAME_SAMPLES; i < end; i++) {
      const v = wav.readInt16LE(start + i * 2) / 32768;
      frameSum += v * v;
    }
    sumSquares += frameSum;
    const frameRms = Math.sqrt(frameSum / (end - f * FRAME_SAMPLES));
    if (frameRms > 0 && 20 * Math.log10(frameRms) > SPEECH_FRAME_DBFS) {
      if (firstSpeech < 0) firstSpeech = f;
      lastSpeech = f;
    }
  }

  const rms = samples > 0 ? Math.sqrt(sumSquares / samples) : 0;
  const speechFrames = firstSpeech < 0 ? 0 : lastSpeech - firstSpeech + 1;
  return {
    bytes: wav.length,
    seconds: round2((samples * 2) / BYTES_PER_SEC),
    dbfs: rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -Infinity,
    speechSeconds: round2((speechFrames * FRAME_SAMPLES) / SAMPLE_RATE),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
