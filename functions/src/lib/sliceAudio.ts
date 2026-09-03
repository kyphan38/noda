/**
 * ffmpeg wrapper — cuts [startSec, endSec) out of a local media file and
 * downmixes it to mono 16kHz WAV, matching the manual ffmpeg invocation
 * validated by hand in the Stage 1 spike (same flags: -ac 1 -ar 16000 -f wav).
 */

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
