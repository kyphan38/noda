/**
 * Speaking check: the learner records one segment (a few sentences, 30-50 words)
 * and gets feedback.
 *
 * Flow: auth -> convert the recording to WAV and check it is not silent -> build a
 * checklist from the cached shadowing analysis of the segment's sentences -> send
 * the original clip and the recording to Gemini -> score the labels in code
 * (lib/speakingScore.ts) -> save the attempt -> return it.
 *
 * Attempts live in users/{uid}/lessons/{lessonId}/speakingAttempts. The recording
 * itself is not stored. onLessonDeleted's recursive delete removes the attempts.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import type { Part } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";

import { convertToWav, sliceAudioClip } from "./lib/sliceAudio";
import { analysisAudioPath, fetchAnalysisAudio } from "./lib/analysisAudio";
import { generateStructuredJson, getShadowingModelId } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError, isGeminiTimeoutError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import { parseClipSource, youtubeClipPart, type ClipSource } from "./lib/clipSource";
import { wavStats } from "./lib/wavStats";
import {
  bandFor,
  normalizeSpeakingAssessment,
  overallScore,
  scoreParts,
  splitWords,
  SpeakingShapeError,
  type NormalizedSpeaking,
} from "./lib/speakingScore";
import {
  buildSpeakingAssessmentPrompt,
  SPEAKING_ASSESSMENT_RESPONSE_SCHEMA,
} from "./prompts/speakingAssessmentPrompt";
import { buildChecklist } from "./lib/speakingChecklist";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
/** Keep in sync with ANALYSIS_VERSION in analyzeShadowingPattern.ts. Older docs give no checklist. */
const SHADOWING_ANALYSIS_VERSION = 4;
/** Shape of the saved attempt. Keep in sync with SPEAKING_ATTEMPT_VERSION in types/index.tsx. */
const ATTEMPT_VERSION = 1;

const GEMINI_TIMEOUT_MS = 60000;
const MAX_SENTENCES = 20;
const MAX_TEXT_CHARS = 2000;
/** Base64 size cap: about 4.5 MB of audio, minutes of opus. Callable bodies stop at 10 MB. */
const MAX_RECORDING_BASE64 = 6_000_000;
const MAX_SEGMENT_SECONDS = 90;
const MIN_SPEECH_SECONDS = 0.5;
const SILENCE_DBFS = -60;

class GeminiJsonParseError extends Error {}

interface AssessSpeakingRequest {
  lessonId: string;
  segmentId: string;
  sentenceIds: number[];
  startSec: number;
  endSec: number;
  referenceText: string;
  source: ClipSource;
  recording: string;
  recordingMimeType: string;
}

function assertValidRequest(data: unknown): AssessSpeakingRequest {
  if (!data || typeof data !== "object") throw new HttpsError("invalid-argument", "Missing request body.");
  const d = data as Record<string, unknown>;
  const bad = (msg: string) => new HttpsError("invalid-argument", msg);

  if (typeof d.lessonId !== "string" || !d.lessonId.trim() || d.lessonId.includes("/")) {
    throw bad("lessonId is required.");
  }
  if (typeof d.segmentId !== "string" || !/^[\w-]{1,40}$/.test(d.segmentId)) throw bad("segmentId is invalid.");
  if (
    !Array.isArray(d.sentenceIds) ||
    d.sentenceIds.length === 0 ||
    d.sentenceIds.length > MAX_SENTENCES ||
    !d.sentenceIds.every((id) => typeof id === "number" && Number.isInteger(id))
  ) {
    throw bad("sentenceIds must be 1-20 integers.");
  }
  if (
    typeof d.startSec !== "number" ||
    typeof d.endSec !== "number" ||
    !Number.isFinite(d.startSec) ||
    !Number.isFinite(d.endSec) ||
    !(d.endSec > d.startSec) ||
    d.endSec - d.startSec > MAX_SEGMENT_SECONDS
  ) {
    throw bad("startSec/endSec must be a range of at most 90 seconds.");
  }
  if (typeof d.referenceText !== "string" || !d.referenceText.trim() || d.referenceText.length > MAX_TEXT_CHARS) {
    throw bad("referenceText is required.");
  }
  const source = parseClipSource(d);
  if ("error" in source) throw bad(source.error);
  if (typeof d.recording !== "string" || !d.recording || d.recording.length > MAX_RECORDING_BASE64) {
    throw bad("recording is missing or too long.");
  }
  if (typeof d.recordingMimeType !== "string" || !/^audio\/[\w.+-]+/.test(d.recordingMimeType)) {
    throw bad("recordingMimeType must be an audio type.");
  }
  return {
    lessonId: d.lessonId,
    segmentId: d.segmentId,
    sentenceIds: d.sentenceIds as number[],
    startSec: d.startSec,
    endSec: d.endSec,
    referenceText: d.referenceText.trim(),
    source,
    recording: d.recording,
    recordingMimeType: d.recordingMimeType,
  };
}

async function callGeminiOnce(
  prompt: string,
  reference: Part | null,
  learner: Part,
  words: string[],
  checkCount: number
): Promise<NormalizedSpeaking> {
  const parts: Part[] = [{ text: prompt }];
  if (reference) parts.push({ text: "REFERENCE:" }, reference);
  parts.push({ text: "LEARNER:" }, learner);

  const text = await generateStructuredJson([{ role: "user", parts }], SPEAKING_ASSESSMENT_RESPONSE_SCHEMA, {
    timeoutMs: GEMINI_TIMEOUT_MS,
    lowMediaResolution: !!reference?.fileData,
    // Closed labels with a rubric: no creativity wanted, so runs stay as close as possible.
    temperature: 0, label: "assessSpeaking"
  });
  if (!text) throw new HttpsError("internal", "Empty response from Gemini.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiJsonParseError("Gemini returned malformed JSON.");
  }
  return normalizeSpeakingAssessment(parsed, words, checkCount);
}

async function callGeminiWithRetry(...args: Parameters<typeof callGeminiOnce>): Promise<NormalizedSpeaking> {
  const retryable = (e: unknown) => e instanceof GeminiJsonParseError || e instanceof SpeakingShapeError;
  for (let attempt = 1; ; attempt++) {
    try {
      return await callGeminiOnce(...args);
    } catch (e) {
      if (isGeminiTimeoutError(e)) throw new HttpsError("deadline-exceeded", "The check timed out, try again.");
      if (!retryable(e)) throw e;
      if (attempt >= 2) {
        console.error("Speaking check unusable after retry:", (e as Error).message);
        throw new HttpsError("internal", "Gemini returned an unusable result, try again.");
      }
      console.warn("Speaking check attempt 1 unusable, retrying:", (e as Error).message);
    }
  }
}

export const assessSpeaking = onCall(
  {
    // Same region as analyzeShadowingPattern; see FUNCTIONS_REGION in lib/auth/firebase-client.ts.
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    // Audio copy on first use + ffmpeg + two Gemini attempts (2 x 60s).
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }
    const uid = request.auth.uid;
    const req = assertValidRequest(request.data);
    const copyPath = req.source.kind === "storage" ? analysisAudioPath(uid, req.source.mediaStoragePath) : null;
    if (req.source.kind === "storage" && !copyPath) {
      throw new HttpsError("invalid-argument", "mediaStoragePath is not one of your uploads.");
    }

    const db = getFirestore(getApp(), NODA_DB_ID);
    if (!(await takeAiCall(db, uid))) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    }
    const lessonPath = `users/${uid}/lessons/${req.lessonId}`;
    const temp: string[] = [];

    try {
      // --- Learner recording: to WAV, then make sure there is speech in it ---
      const rawPath = path.join(os.tmpdir(), `rec-in-${randomUUID()}`);
      writeFileSync(rawPath, Buffer.from(req.recording, "base64"));
      temp.push(rawPath);
      const learnerWavPath = await convertToWav(rawPath);
      temp.push(learnerWavPath);
      const learnerWav = readFileSync(learnerWavPath);
      const learner = wavStats(learnerWav);
      if (learner.dbfs < SILENCE_DBFS || learner.speechSeconds < MIN_SPEECH_SECONDS) {
        throw new HttpsError("failed-precondition", "We could not hear you, try again.");
      }

      // --- Reference clip of the original speaker ---
      let reference: Part;
      let referenceSeconds = req.endSec - req.startSec;
      if (req.source.kind === "youtube") {
        reference = youtubeClipPart(req.source.youtubeVideoId, req.startSec, req.endSec);
      } else {
        const audioPath = await fetchAnalysisAudio(getStorage().bucket(), req.source.mediaStoragePath, copyPath!);
        temp.push(audioPath);
        const clipPath = await sliceAudioClip(audioPath, req.startSec, req.endSec);
        temp.push(clipPath);
        const clipBuffer = readFileSync(clipPath);
        const stats = wavStats(clipBuffer);
        if (stats.speechSeconds > 0) referenceSeconds = stats.speechSeconds;
        reference = { inlineData: { mimeType: "audio/wav", data: clipBuffer.toString("base64") } };
      }

      // --- Checklist from the shadowing analysis already done for these sentences ---
      const refs = req.sentenceIds.map((id) => db.doc(`${lessonPath}/shadowingAnalysis/${id}`));
      const snaps = await db.getAll(...refs);
      const checklist = buildChecklist(snaps.map((s) => s.data()), SHADOWING_ANALYSIS_VERSION);

      const words = splitWords(req.referenceText);
      const prompt = buildSpeakingAssessmentPrompt(words, checklist, true);
      console.info("Speaking check", {
        lessonId: req.lessonId,
        segmentId: req.segmentId,
        words: words.length,
        checks: checklist.length,
        learnerSeconds: learner.speechSeconds,
        referenceSeconds,
      });
      const labels = await callGeminiWithRetry(
        prompt,
        reference,
        { inlineData: { mimeType: "audio/wav", data: learnerWav.toString("base64") } },
        words,
        checklist.length
      );

      const parts = scoreParts({
        wordCount: words.length,
        issues: labels.issues,
        checks: labels.checks,
        criteria: labels.criteria,
        learnerSeconds: learner.speechSeconds,
        referenceSeconds,
      });
      const score = overallScore(parts);
      const attempt = {
        version: ATTEMPT_VERSION,
        segmentId: req.segmentId,
        sentenceIds: req.sentenceIds,
        referenceText: req.referenceText,
        score,
        band: bandFor(score),
        parts,
        wordIssues: labels.issues,
        checks: labels.checks.map((c) => ({ ...c, ...checklist[c.id] })),
        criteria: labels.criteria,
        delivery: labels.delivery,
        fixes: labels.fixes,
        learnerSeconds: learner.speechSeconds,
        referenceSeconds,
        model: getShadowingModelId(),
      };
      const ref = await db.collection(`${lessonPath}/speakingAttempts`).add({
        ...attempt,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ...attempt, id: ref.id, createdAt: Date.now() };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (isGeminiQuotaError(e)) {
        console.error("Gemini quota:", (e as Error).message);
        throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
      }
      const message = e instanceof Error ? e.message : "Unknown error";
      if (/ffmpeg|sigsegv|signal|killed|ffprobe|invalid data/i.test(message)) {
        console.error("Speaking check audio processing failed:", message);
        throw new HttpsError("internal", "Could not read the recording, try again.");
      }
      throw new HttpsError("internal", message);
    } finally {
      for (const p of temp) {
        try {
          unlinkSync(p);
        } catch {
          // best-effort tmp cleanup
        }
      }
    }
  }
);
