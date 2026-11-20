/**
 * Talk turn: the learner answers the persona out loud; one Gemini call returns
 * the exact transcript, the persona's next line and a short review.
 *
 * Flow: auth -> recording to WAV, reject silence -> read the topic (persona,
 * level, target phrases) -> Gemini -> parse, one retry on a bad shape -> return.
 * Nothing is saved here: the app keeps the session. The recording is not stored.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type, type Schema } from "@google/genai";
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
import {
  buildTurnPrompt,
  checkTurnRequest,
  FIX_KINDS,
  FIX_PATTERNS,
  frameFor,
  parseTurnResult,
  TurnShapeError,
  type Level,
  type TurnResult,
} from "./lib/talkTurn";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 45000;
/** Base64 size cap: a couple of minutes of opus. Callable bodies stop at 10 MB. */
const MAX_RECORDING_BASE64 = 6_000_000;
const MIN_SPEECH_SECONDS = 0.5;
const SILENCE_DBFS = -60;

const STR = { type: Type.STRING };
const TURN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    transcript: STR,
    review: {
      type: Type.OBJECT,
      properties: {
        correct: STR,
        natural: STR,
        levelUp: STR,
        structure: STR,
        fixes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              wrong: STR,
              right: STR,
              why: STR,
              kind: { type: Type.STRING, enum: [...FIX_KINDS] },
              pattern: { type: Type.STRING, enum: [...FIX_PATTERNS] },
            },
            required: ["wrong", "right", "why", "kind", "pattern"],
          },
        },
      },
      required: ["correct", "natural", "levelUp", "fixes"],
    },
    reply: {
      type: Type.OBJECT,
      properties: { text: STR, curveball: { type: Type.BOOLEAN }, ideas: { type: Type.ARRAY, items: STR } },
      required: ["text", "curveball", "ideas"],
    },
    usedPhraseIds: { type: Type.ARRAY, items: STR },
  },
  required: ["transcript", "review", "reply", "usedPhraseIds"],
};

type TopicDoc = {
  title?: string;
  level?: Level;
  presetId?: string;
  persona?: { name: string; role: string; style: string };
  phrases?: { id: string; text: string }[];
  scenarios?: { id: string; facts: string[] }[];
};

export const talkTurn = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    // ffmpeg + two Gemini attempts.
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request): Promise<TurnResult & { seconds: number }> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }
    const uid = request.auth.uid;
    let req;
    try {
      req = checkTurnRequest(request.data);
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
    const topicSnap = await db.doc(`users/${uid}/talkTopics/${req.topicId}`).get();
    const topic = topicSnap.data() as TopicDoc | undefined;
    if (!topic?.persona || !topic.level) throw new HttpsError("not-found", "Topic not found.");
    const byId = new Map((topic.phrases ?? []).map((p) => [p.id, p.text]));
    const targets = req.targetIds.filter((id) => byId.has(id)).map((id) => ({ id, text: byId.get(id)! }));

    const temp: string[] = [];
    try {
      const rawPath = path.join(os.tmpdir(), `talk-in-${randomUUID()}`);
      writeFileSync(rawPath, Buffer.from(d.recording, "base64"));
      temp.push(rawPath);
      const wavPath = await convertToWav(rawPath);
      temp.push(wavPath);
      const wav = readFileSync(wavPath);
      const stats = wavStats(wav);
      // Silence is rejected before the daily cap and the model call: free to retry.
      if (stats.dbfs < SILENCE_DBFS || stats.speechSeconds < MIN_SPEECH_SECONDS) {
        throw new HttpsError("failed-precondition", "We could not hear you, try again.");
      }
      if (!(await takeAiCall(db, uid))) {
        throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
      }

      const prompt = buildTurnPrompt(req, {
        level: topic.level,
        frame: frameFor(topic.presetId),
        topicTitle: topic.title ?? "",
        persona: topic.persona,
        targets,
        facts: topic.scenarios?.find((s) => s.id === req.scenarioId)?.facts ?? [],
      });
      const audio = { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } };
      for (let attempt = 1; ; attempt++) {
        try {
          const raw = await generateStructuredJson([{ role: "user", parts: [{ text: prompt }, audio] }], TURN_SCHEMA, {
            timeoutMs: GEMINI_TIMEOUT_MS,
            // Low: the transcript must not be "improved"; a little room for the reply.
            temperature: 0.3,
          });
          const result = parseTurnResult(raw, targets.map((t) => t.id));
          if (!result.transcript) throw new HttpsError("failed-precondition", "We could not hear you, try again.");
          return { ...result, seconds: Math.round(stats.speechSeconds * 10) / 10 };
        } catch (e) {
          if (!(e instanceof TurnShapeError) || attempt >= 2) throw e;
          console.warn("[talkTurn] bad shape, retrying:", e.message);
        }
      }
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
      if (isGeminiTimeoutError(e)) throw new HttpsError("deadline-exceeded", "That took too long, try again.");
      // The error only: never the transcript.
      console.error("[talkTurn] failed", e instanceof Error ? e.message : String(e));
      throw new HttpsError("internal", "Could not check this answer, try again.");
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
