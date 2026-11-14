/**
 * Stage 3 - callable Cloud Function with Firestore cache: reads
 * users/{uid}/lessons/{lessonId}/shadowingAnalysis/{sentenceId} first and
 * returns it as-is if present, skipping ffmpeg + Gemini entirely. Only on a
 * cache miss does it fall through to Stage 2's flow (download -> slice ->
 * Gemini), then writes the result back to that same doc.
 *
 * YouTube lessons send `youtubeVideoId` instead of `mediaStoragePath`: Gemini
 * reads the sentence's time range from YouTube, with no download or ffmpeg.
 *
 * Flow: verify caller uid == ALLOWED_USER_UID -> check Firestore cache ->
 * (miss) fetch the small analysis-audio copy (built from the source media on
 * first use, see lib/analysisAudio.ts) -> ffmpeg-slice
 * [startSec, endSec) -> base64 -> Gemini structured output -> write cache ->
 * return the parsed analysis object.
 *
 * See /Users/kyphan/.claude/plans/ok-v-y-b-y-gi-delegated-garden.md
 * ("## Data model", "### Stage 3") for the exact doc path/shape.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import type { Part } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, unlinkSync } from "fs";

import { sliceAudioClip } from "./lib/sliceAudio";
import { wavStats } from "./lib/wavStats";
import { isGeminiTimeoutError } from "./lib/geminiErrors";
import { analysisAudioPath, fetchAnalysisAudio } from "./lib/analysisAudio";
import { generateShadowingJson, getShadowingModelId } from "./lib/geminiClient";
import { parseClipSource, youtubeClipPart, type ClipSource } from "./lib/clipSource";
import { buildShadowingAnalysisPrompt } from "./prompts/shadowingAnalysisPrompt";
import {
  normalizeShadowingAnalysis,
  ShadowingShapeError,
  type NormalizedAnalysis,
} from "./lib/normalizeShadowingAnalysis";

/** Firestore database id owned by noda. Now `(default)` again: noda has its own
 * Firebase project (`kyphan38-noda-app`), so it no longer needs the named
 * `noda-db` that the shared `kyphan38-apps` project forced on it. Hardcoded
 * because `functions/` is a separate package and cannot import
 * `lib/firebase-db-id.ts` - keep both in sync. See `PLAN-project-split.md`. */
const NODA_DB_ID = "(default)";

/** Analysis shape version. Keep in sync with `SHADOWING_ANALYSIS_VERSION` in types/index.tsx.
 * A cached doc with any other version is ignored and re-analyzed: v1 docs described four
 * independent sections and cannot be converted to v2's chunk/token structure. v3 keeps the
 * v2 shape (plus an optional `notes[].via`) but re-analyzes v2 docs, whose `sounds` mixed in
 * accented, non-English respellings. v4 keeps the shape and re-analyzes so `why` is English. */
const ANALYSIS_VERSION = 4;

/** Gemini budget per attempt. Raised twice as the response grew: v1's 25s, then 40s for the
 * v2 schema (19.6s worst case measured), and now 55s because sweeping every junction instead
 * of the top few pushed one real sentence to 36.9s. A timeout is not retried, so a tight
 * budget turns a slow sentence into a hard failure. */
const GEMINI_TIMEOUT_MS = 55000;

/** Stage 6: thrown when Gemini's response text fails JSON.parse - caught by the
 * caller to trigger a single automatic retry before giving up. */
class GeminiJsonParseError extends Error {}

/** One Gemini call attempt: generate + parse JSON. Throws GeminiJsonParseError
 * on malformed JSON so the caller can retry once; timeout/other errors
 * propagate as-is. */
async function callGeminiOnce(sourceText: string, clip: Part): Promise<NormalizedAnalysis> {
  const text = await generateShadowingJson(
    [
      {
        role: "user",
        parts: [{ text: buildShadowingAnalysisPrompt(sourceText) }, clip],
      },
    ],
    GEMINI_TIMEOUT_MS,
    !!clip.fileData
  );
  if (!text) {
    throw new HttpsError("internal", "Empty response from Gemini.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiJsonParseError("Gemini returned malformed JSON.");
  }

  // Throws ShadowingShapeError on an unusable response, which the caller retries
  // once - the cache doc is permanent, so nothing malformed may reach it.
  return normalizeShadowingAnalysis(parsed, sourceText);
}

/** Stage 6: one call, with a single automatic retry on malformed JSON
 * or an unusable shape (timeouts are not retried - they already ate the full budget). */
/** `clip`: a sliced WAV (`inlineData`) or a YouTube time range (`fileData`, see lib/clipSource.ts). */
async function callGeminiWithRetry(sourceText: string, clip: Part): Promise<NormalizedAnalysis> {
  const isRetryable = (e: unknown) => e instanceof GeminiJsonParseError || e instanceof ShadowingShapeError;

  try {
    return await callGeminiOnce(sourceText, clip);
  } catch (e) {
    if (isGeminiTimeoutError(e)) {
      throw new HttpsError("deadline-exceeded", "Analysis timed out, try again.");
    }
    if (!isRetryable(e)) throw e;

    // Malformed JSON or an unusable shape on attempt 1 - retry exactly once.
    console.warn("Shadowing analysis attempt 1 unusable, retrying:", (e as Error).message);
    try {
      return await callGeminiOnce(sourceText, clip);
    } catch (e2) {
      if (isGeminiTimeoutError(e2)) {
        throw new HttpsError("deadline-exceeded", "Analysis timed out, try again.");
      }
      if (isRetryable(e2)) {
        console.error("Shadowing analysis unusable after retry:", (e2 as Error).message);
        throw new HttpsError("internal", "Gemini returned an unusable result, try again.");
      }
      throw e2;
    }
  }
}

const MIN_CLIP_SECONDS = 0.3;
/** Real speech sits around -30 dBFS; digital silence is far below this. */
const SILENCE_DBFS = -60;

interface AnalyzeShadowingPatternRequest {
  lessonId: string;
  sentenceId: number;
  startSec: number;
  endSec: number;
  source: ClipSource;
  sourceText: string;
}

function assertValidRequest(data: unknown): AnalyzeShadowingPatternRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Missing request body.");
  }
  const d = data as Record<string, unknown>;

  if (typeof d.lessonId !== "string" || !d.lessonId.trim()) {
    throw new HttpsError("invalid-argument", "lessonId is required.");
  }
  if (typeof d.sentenceId !== "number" || !Number.isFinite(d.sentenceId)) {
    throw new HttpsError("invalid-argument", "sentenceId must be a number.");
  }
  if (
    typeof d.startSec !== "number" ||
    typeof d.endSec !== "number" ||
    !Number.isFinite(d.startSec) ||
    !Number.isFinite(d.endSec) ||
    !(d.endSec > d.startSec)
  ) {
    throw new HttpsError("invalid-argument", "startSec/endSec must be numbers with endSec > startSec.");
  }
  const source = parseClipSource(d);
  if ("error" in source) {
    throw new HttpsError("invalid-argument", source.error);
  }
  if (typeof d.sourceText !== "string" || !d.sourceText.trim()) {
    throw new HttpsError("invalid-argument", "sourceText is required.");
  }

  return {
    lessonId: d.lessonId,
    sentenceId: d.sentenceId,
    startSec: d.startSec,
    endSec: d.endSec,
    source,
    sourceText: d.sourceText,
  };
}

export const analyzeShadowingPattern = onCall(
  {
    // Must match the region the client calls with - see `FUNCTIONS_REGION` in
    // `lib/auth/firebase-client.ts`. A mismatch is silent at build time and
    // only shows up as a 404/CORS failure at call time, so change both together.
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    // Worst case is download + ffmpeg + two full Gemini attempts (2 x 55s), which needs
    // headroom over 110s or a retry gets cut off and surfaces as a generic internal error.
    // The client waits longer than this - see lib/shadowingAnalysis.ts.
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    // --- Auth: single allowlisted user only (mirrors NEXT_PUBLIC_ALLOWED_USER_UID) ---
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }

    const { lessonId, sentenceId, startSec, endSec, source, sourceText } = assertValidRequest(request.data);
    // The media path comes from the client; only ever read the caller's own uploads.
    const copyPath =
      source.kind === "storage" ? analysisAudioPath(request.auth.uid, source.mediaStoragePath) : null;
    if (source.kind === "storage" && !copyPath) {
      throw new HttpsError("invalid-argument", "mediaStoragePath is not one of your uploads.");
    }

    const cacheDocRef = getFirestore(getApp(), NODA_DB_ID).doc(
      `users/${request.auth.uid}/lessons/${lessonId}/shadowingAnalysis/${sentenceId}`
    );

    const cachedSnapshot = await cacheDocRef.get();
    const cached = cachedSnapshot.data();
    // A doc written by an older analysis version describes a shape the panel can no
    // longer render, so it counts as a miss and gets overwritten below.
    if (cached && cached.version === ANALYSIS_VERSION) {
      return cached;
    }

    let audioPath: string | null = null;
    let clipPath: string | null = null;

    try {
      let clipPart: Part;
      if (source.kind === "youtube") {
        // Gemini reads the time range from YouTube itself: nothing to download or slice,
        // and so no loudness check. A too-short range is the one thing to catch here.
        if (endSec - startSec < MIN_CLIP_SECONDS) {
          throw new HttpsError("failed-precondition", "No audio found for this sentence.");
        }
        console.info("Shadowing clip", { lessonId, sentenceId, startSec, endSec, youtube: source.youtubeVideoId });
        clipPart = youtubeClipPart(source.youtubeVideoId, startSec, endSec);
      } else {
        // A small mono FLAC copy instead of the full upload - see lib/analysisAudio.ts.
        audioPath = await fetchAnalysisAudio(getStorage().bucket(), source.mediaStoragePath, copyPath!);

        clipPath = await sliceAudioClip(audioPath, startSec, endSec);

        const clipBuffer = readFileSync(clipPath);
        const clip = wavStats(clipBuffer);
        console.info("Shadowing clip", { lessonId, sentenceId, startSec, endSec, ...clip });
        // An empty or silent clip makes Gemini invent a sentence that never matches the
        // transcript, so both attempts fail slowly. Stop here with a clear message instead.
        if (clip.seconds < MIN_CLIP_SECONDS || clip.dbfs < SILENCE_DBFS) {
          throw new HttpsError("failed-precondition", "No audio found for this sentence.");
        }
        clipPart = { inlineData: { mimeType: "audio/wav", data: clipBuffer.toString("base64") } };
      }

      const analysis = await callGeminiWithRetry(sourceText, clipPart);

      const analysisResult = {
        sentenceId,
        startSec,
        endSec,
        sourceText,
        model: getShadowingModelId(),
        version: ANALYSIS_VERSION,
        analysis,
      };

      await cacheDocRef.set({
        ...analysisResult,
        createdAt: FieldValue.serverTimestamp(),
        generatedBy: "cloud-function-v2",
      });

      return analysisResult;
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const message = e instanceof Error ? e.message : "Unknown error";
      // An ffmpeg crash (e.g. "killed with signal SIGSEGV") is raw and unreadable.
      // Log it in full on the server; show the user one short line.
      if (/ffmpeg|sigsegv|signal|killed|ffprobe/i.test(message)) {
        console.error("Shadowing analysis audio processing failed:", message);
        throw new HttpsError("internal", "Could not read this audio file, try another file.");
      }
      throw new HttpsError("internal", message);
    } finally {
      for (const p of [audioPath, clipPath]) {
        if (!p) continue;
        try {
          unlinkSync(p);
        } catch {
          // best-effort tmp cleanup
        }
      }
    }
  }
);
