/**
 * Where a sentence's audio comes from for shadowing analysis: an upload in
 * Storage (sliced with ffmpeg) or a YouTube video (Gemini reads the time range
 * itself, PLAN-youtube.md P4). No imports, so root unit tests can load it.
 */

export type ClipSource =
  | { kind: "storage"; mediaStoragePath: string }
  | { kind: "youtube"; youtubeVideoId: string };

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Reads exactly one of `mediaStoragePath` / `youtubeVideoId` from the request.
 * Returns an error message for the caller to throw as invalid-argument.
 */
export function parseClipSource(data: Record<string, unknown>): ClipSource | { error: string } {
  const path = data.mediaStoragePath;
  const videoId = data.youtubeVideoId;
  const hasPath = typeof path === "string" && path.trim() !== "";
  const hasVideo = videoId !== undefined && videoId !== null && videoId !== "";
  if (hasPath && hasVideo) return { error: "Send mediaStoragePath or youtubeVideoId, not both." };
  if (hasVideo) {
    // Only ever build the YouTube URL from a well-formed id: never pass a client URL on.
    if (typeof videoId !== "string" || !YOUTUBE_VIDEO_ID.test(videoId)) {
      return { error: "youtubeVideoId is not a YouTube video id." };
    }
    return { kind: "youtube", youtubeVideoId: videoId };
  }
  if (hasPath) return { kind: "storage", mediaStoragePath: path as string };
  return { error: "mediaStoragePath or youtubeVideoId is required." };
}

/** Gemini content part for one sentence of a YouTube video (POC: 8/10 exact, 2 off by one edge word). */
export function youtubeClipPart(youtubeVideoId: string, startSec: number, endSec: number) {
  return {
    fileData: { fileUri: `https://www.youtube.com/watch?v=${youtubeVideoId}`, mimeType: "video/*" },
    videoMetadata: { startOffset: `${startSec.toFixed(2)}s`, endOffset: `${endSec.toFixed(2)}s` },
  };
}
