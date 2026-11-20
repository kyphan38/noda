/**
 * Talk speech: a longer recording for the drills. Transcribe (4/3/2 drill,
 * Time Capsule) or retell a pasted text (Read-to-Speak). One model call;
 * nothing is saved here. The recording is not stored by this function.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { SPEECH_SCHEMA } from "./lib/talkSchemas";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";

import { convertToWav } from "./lib/sliceAudio";
import { generateStructuredJson } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError, isGeminiTimeoutError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import { wavStats } from "./lib/wavStats";
import { buildSpeechPrompt, checkSpeechRequest, parseSpeech, SpeechShapeError, type SpeechResult } from "./lib/talkSpeech";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 60000;
const MAX_RECORDING_BASE64 = 6_000_000;
const MIN_SPEECH_SECONDS = 0.5;
const SILENCE_DBFS = -60;

export const talkSpeech = onCall(
  { region: "asia-southeast1", secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"], timeoutSeconds: 150, memory: "512MiB" },
  async (request): Promise<SpeechResult & { seconds: number }> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) throw new HttpsError("permission-denied", "This tool is single-user only.");
    const uid = request.auth.uid;
    let req;
    try {
      req = checkSpeechRequest(request.data);
    } catch (e) {
      throw new HttpsError("invalid-argument", e instanceof Error ? e.message : "Bad request.");
    }
    const d = request.data as { recording?: unknown; recordingMimeType?: unknown };
    if (typeof d.recording !== "string" || !d.recording || d.recording.length > MAX_RECORDING_BASE64) {
      throw new HttpsError("invalid-argument", "The recording is missing or too long.");
    }
    if (typeof d.recordingMimeType !== "string" || !/^audio\/[\w.+-]+/.test(d.recordingMimeType)) {
      throw new HttpsError("invalid-argument", "The recording type is not audio.");
    }

    const db = getFirestore(getApp(), NODA_DB_ID);
    const temp: string[] = [];
    try {
      const rawPath = path.join(os.tmpdir(), `speech-in-${randomUUID()}`);
      writeFileSync(rawPath, Buffer.from(d.recording, "base64"));
      temp.push(rawPath);
      const wavPath = await convertToWav(rawPath);
      temp.push(wavPath);
      const wav = readFileSync(wavPath);
      const stats = wavStats(wav);
      if (stats.dbfs < SILENCE_DBFS || stats.speechSeconds < MIN_SPEECH_SECONDS) {
        throw new HttpsError("failed-precondition", "We could not hear you, try again.");
      }
      if (!(await takeAiCall(db, uid))) throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");

      const parts = [{ text: buildSpeechPrompt(req) }, { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }];
      for (let attempt = 1; ; attempt++) {
        try {
          const raw = await generateStructuredJson([{ role: "user", parts }], SPEECH_SCHEMA, { timeoutMs: GEMINI_TIMEOUT_MS, temperature: 0.2, label: "talkSpeech" });
          const result = parseSpeech(raw, req.mode);
          if (!result.transcript) throw new HttpsError("failed-precondition", "We could not hear you, try again.");
          return { ...result, seconds: Math.round(stats.speechSeconds * 10) / 10 };
        } catch (e) {
          if (!(e instanceof SpeechShapeError) || attempt >= 2) throw e;
          console.warn("[talkSpeech] bad shape, retrying:", e.message);
        }
      }
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
      if (isGeminiTimeoutError(e)) throw new HttpsError("deadline-exceeded", "That took too long, try again.");
      console.error("[talkSpeech] failed", e instanceof Error ? e.message : String(e));
      throw new HttpsError("internal", "Could not check this recording, try again.");
    } finally {
      for (const f of temp) {
        try {
          unlinkSync(f);
        } catch {
          // Already gone.
        }
      }
    }
  }
);
