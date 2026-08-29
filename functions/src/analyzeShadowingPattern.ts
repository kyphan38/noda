/**
 * Stage 3 - callable Cloud Function with Firestore cache: reads
 * users/{uid}/lessons/{lessonId}/shadowingAnalysis/{sentenceId} first and
 * returns it as-is if present, skipping ffmpeg + Gemini entirely. Only on a
 * cache miss does it fall through to Stage 2's flow (download -> slice ->
 * Gemini), then writes the result back to that same doc.
 *
 * Flow: verify caller uid == ALLOWED_USER_UID -> check Firestore cache ->
 * (miss) download source media from Storage -> ffmpeg-slice
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
import { FieldValue } from "firebase-admin/firestore";
import { readFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";

import { sliceAudioClip } from "./lib/sliceAudio";
import { getShadowingModel } from "./lib/geminiClient";
import { buildShadowingAnalysisPrompt } from "./prompts/shadowingAnalysisPrompt";
import type { GenerativeModel } from "@google/generative-ai";

/** Stage 6: thrown when Gemini's response text fails JSON.parse - caught by the
 * caller to trigger a single automatic retry before giving up. */
class GeminiJsonParseError extends Error {}

/** Stage 6: the SDK's `requestOptions.timeout` (25000ms) aborts the underlying
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
async function callGeminiOnce(
  model: GenerativeModel,
  sourceText: string,
  base64ClipAudio: string
): Promise<unknown> {
  const result = await model.generateContent(
    {
      contents: [
        {
          role: "user",
          parts: [
            { text: buildShadowingAnalysisPrompt(sourceText) },
            { inlineData: { mimeType: "audio/wav", data: base64ClipAudio } },
          ],
        },
      ],
    },
    { timeout: 25000 } // same convention as cogi's routes
  );

  const text = result.response.text();
  if (!text) {
    throw new HttpsError("internal", "Empty response from Gemini.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiJsonParseError("Gemini returned malformed JSON.");
  }
}

/** Stage 6: one call, with a single automatic retry on malformed JSON
 * (timeouts are not retried - they already ate the full 25s budget). */
async function callGeminiWithRetry(
  model: GenerativeModel,
  sourceText: string,
  base64ClipAudio: string
): Promise<unknown> {
  try {
    return await callGeminiOnce(model, sourceText, base64ClipAudio);
  } catch (e) {
    if (isGeminiTimeoutError(e)) {
      throw new HttpsError("deadline-exceeded", "Hết thời gian phân tích, thử lại.");
    }
    if (!(e instanceof GeminiJsonParseError)) throw e;

    // Malformed JSON on attempt 1 - retry exactly once (đã chốt trong plan).
    try {
      return await callGeminiOnce(model, sourceText, base64ClipAudio);
    } catch (e2) {
      if (isGeminiTimeoutError(e2)) {
        throw new HttpsError("deadline-exceeded", "Hết thời gian phân tích, thử lại.");
      }
      throw new HttpsError("internal", "Gemini returned malformed JSON after retry.");
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
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    timeoutSeconds: 60,
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

    const cacheDocRef = admin
      .firestore()
      .doc(`users/${request.auth.uid}/lessons/${lessonId}/shadowingAnalysis/${sentenceId}`);

    const cachedSnapshot = await cacheDocRef.get();
    if (cachedSnapshot.exists) {
      return cachedSnapshot.data();
    }

    const downloadPath = path.join(os.tmpdir(), `media-${randomUUID()}-${path.basename(mediaStoragePath)}`);
    let clipPath: string | null = null;

    try {
      await admin.storage().bucket().file(mediaStoragePath).download({ destination: downloadPath });

      clipPath = await sliceAudioClip(downloadPath, startSec, endSec);

      const base64ClipAudio = readFileSync(clipPath).toString("base64");

      const model = getShadowingModel();
      const analysis = await callGeminiWithRetry(model, sourceText, base64ClipAudio);

      const analysisResult = {
        sentenceId,
        startSec,
        endSec,
        sourceText,
        model: process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash",
        analysis,
      };

      await cacheDocRef.set({
        ...analysisResult,
        createdAt: FieldValue.serverTimestamp(),
        generatedBy: "cloud-function-v1",
      });

      return analysisResult;
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const message = e instanceof Error ? e.message : "Unknown error";
      throw new HttpsError("internal", message);
    } finally {
      for (const p of [downloadPath, clipPath]) {
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
