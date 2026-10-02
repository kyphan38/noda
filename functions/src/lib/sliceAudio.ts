/**
 * ffmpeg wrapper — cuts [startSec, endSec) out of a local media file and
 * downmixes it to mono 16kHz WAV, matching the manual ffmpeg invocation
 * validated by hand in the Stage 1 spike (same flags: -ac 1 -ar 16000 -f wav).
 */

import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";

if (!ffmpegPath) {
  throw new Error("ffmpeg-static did not install a binary for this platform.");
}
ffmpeg.setFfmpegPath(ffmpegPath);

export function sliceAudioClip(inputPath: string, startSec: number, endSec: number): Promise<string> {
  const duration = endSec - startSec;
  if (!(duration > 0)) {
    return Promise.reject(new Error(`Invalid clip range: startSec=${startSec} endSec=${endSec}`));
  }

  const outputPath = path.join(os.tmpdir(), `slice-${randomUUID()}.wav`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .duration(duration)
      .audioChannels(1)
      .audioFrequency(16000)
      .noVideo()
      .format("wav")
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve(outputPath))
      .save(outputPath);
  });
}

/**
 * Converts a whole media file (a local path or an https URL) to mono 16kHz FLAC - the same channel layout and
 * sample rate `sliceAudioClip` produces, stored losslessly so slicing the copy
 * gives the same samples as slicing the original.
 */
export function extractAnalysisAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("flac")
      // 16-bit like the WAV clips; ffmpeg's FLAC default is 24-bit, which doubles the size.
      .outputOptions(["-sample_fmt s16"])
      .noVideo()
      .format("flac")
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(outputPath);
  });
}
