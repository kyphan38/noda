/**
 * Stage 3 - callable Cloud Function with Firestore cache: reads
 * users/{uid}/lessons/{lessonId}/shadowingAnalysis/{sentenceId} first and
 * returns it as-is if present, skipping ffmpeg + Gemini entirely. Only on a
 * cache miss does it fall through to Stage 2's flow (download -> slice ->
 * Gemini), then writes the result back to that same doc.
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
import * as admin from "firebase-admin";
// NOTE: `admin.firestore.FieldValue` is undefined under the Functions
// Emulator - the emulator wraps `admin.firestore` to auto-point at the
// Firestore emulator host but does not copy the static FieldValue/Timestamp
// members onto the wrapper. Import the modular API directly instead (works
// in both the emulator and production).
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync, unlinkSync } from "fs";

import { sliceAudioClip } from "./lib/sliceAudio";
import { analysisAudioPath, fetchAnalysisAudio } from "./lib/analysisAudio";
import { generateShadowingJson, getShadowingModelId } from "./lib/geminiClient";
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
 * independent sections and cannot be converted to v2's chunk/token structure. */
const ANALYSIS_VERSION = 2;

/** Gemini budget per attempt. Raised twice as the response grew: v1's 25s, then 40s for the
 * v2 schema (19.6s worst case measured), and now 55s because sweeping every junction instead
 * of the top few pushed one real sentence to 36.9s. A timeout is not retried, so a tight
 * budget turns a slow sentence into a hard failure. */
const GEMINI_TIMEOUT_MS = 55000;

/** Stage 6: thrown when Gemini's response text fails JSON.parse - caught by the
 * caller to trigger a single automatic retry before giving up. */
class GeminiJsonParseError extends Error {}

/** Stage 6: the SDK's `httpOptions.timeout` (GEMINI_TIMEOUT_MS) aborts the underlying
 * fetch on timeout, surfacing as an AbortError (or a message mentioning
 * timeout/aborted depending on the runtime) - detect both. */
function isGeminiTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = e.name?.toLowerCase() ?? "";
  const message = e.message?.toLowerCase() ?? "";
  return name.includes("abort") || message.includes("timeout") || message.includes("timed out") || message.includes("aborted");
}

/** One Gemini call attempt: generate + parse JSON. Throws GeminiJsonParseError
 * on malformed JSON so the caller can retry once; timeout/other errors
 * propagate as-is. */
async function callGeminiOnce(sourceText: string, base64ClipAudio: string): Promise<NormalizedAnalysis> {
  const text = await generateShadowingJson(
    [
      {
        role: "user",
        parts: [
          { text: buildShadowingAnalysisPrompt(sourceText) },
          { inlineData: { mimeType: "audio/wav", data: base64ClipAudio } },
        ],
      },
    ],
    GEMINI_TIMEOUT_MS
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
async function callGeminiWithRetry(sourceText: string, base64ClipAudio: string): Promise<NormalizedAnalysis> {
  const isRetryable = (e: unknown) => e instanceof GeminiJsonParseError || e instanceof ShadowingShapeError;

  try {
    return await callGeminiOnce(sourceText, base64ClipAudio);
  } catch (e) {
    if (isGeminiTimeoutError(e)) {
      throw new HttpsError("deadline-exceeded", "Hết thời gian phân tích, thử lại.");
    }
    if (!isRetryable(e)) throw e;

    // Malformed JSON or an unusable shape on attempt 1 - retry exactly once.
    console.warn("Shadowing analysis attempt 1 unusable, retrying:", (e as Error).message);
    try {
      return await callGeminiOnce(sourceText, base64ClipAudio);
    } catch (e2) {
      if (isGeminiTimeoutError(e2)) {
        throw new HttpsError("deadline-exceeded", "Hết thời gian phân tích, thử lại.");
      }
      if (isRetryable(e2)) {
        console.error("Shadowing analysis unusable after retry:", (e2 as Error).message);
        throw new HttpsError("internal", "Gemini trả kết quả không dùng được, thử lại.");
      }
      throw e2;
    }
  }
}

interface AnalyzeShadowingPatternRequest {
  lessonId: string;
  sentenceId: number;
  startSec: number;
  endSec: number;
  mediaStoragePath: string;
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
  if (typeof d.mediaStoragePath !== "string" || !d.mediaStoragePath.trim()) {
    throw new HttpsError("invalid-argument", "mediaStoragePath is required.");
  }
  if (typeof d.sourceText !== "string" || !d.sourceText.trim()) {
    throw new HttpsError("invalid-argument", "sourceText is required.");
  }

  return {
    lessonId: d.lessonId,
    sentenceId: d.sentenceId,
    startSec: d.startSec,
    endSec: d.endSec,
    mediaStoragePath: d.mediaStoragePath,
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

    const { lessonId, sentenceId, startSec, endSec, mediaStoragePath, sourceText } = assertValidRequest(
      request.data
    );
    // The media path comes from the client; only ever read the caller's own uploads.
    const copyPath = analysisAudioPath(request.auth.uid, mediaStoragePath);
    if (!copyPath) {
      throw new HttpsError("invalid-argument", "mediaStoragePath is not one of your uploads.");
    }

    // `admin.firestore()` always targets `(default)` and cannot take a database
    // id - use the modular `getFirestore(app, dbId)` form instead.
    const cacheDocRef = getFirestore(admin.app(), NODA_DB_ID).doc(
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
      // A small mono FLAC copy instead of the full upload - see lib/analysisAudio.ts.
      audioPath = await fetchAnalysisAudio(admin.storage().bucket(), mediaStoragePath, copyPath);

      clipPath = await sliceAudioClip(audioPath, startSec, endSec);

      const base64ClipAudio = readFileSync(clipPath).toString("base64");

      const analysis = await callGeminiWithRetry(sourceText, base64ClipAudio);

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
