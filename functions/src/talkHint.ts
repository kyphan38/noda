/**
 * Talk hint, level 2: chunks to say an idea the learner typed in simple words.
 * One small text call, counted in the daily cap. Nothing is saved.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type, type Schema } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generateStructuredJson } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import { buildHintPrompt, checkHintRequest, parseHints, type TalkHint } from "./lib/talkHint";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 20000;

const STR = { type: Type.STRING };
const HINT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { hints: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: STR, use: STR }, required: ["text", "use"] } } },
  required: ["hints"],
};

export const talkHint = onCall(
  { region: "asia-southeast1", secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"], timeoutSeconds: 60 },
  async (request): Promise<{ hints: TalkHint[] }> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) throw new HttpsError("permission-denied", "This tool is single-user only.");
    const uid = request.auth.uid;
    let req;
    try {
      req = checkHintRequest(request.data);
    } catch (e) {
      throw new HttpsError("invalid-argument", e instanceof Error ? e.message : "Bad request.");
    }
    const db = getFirestore(getApp(), NODA_DB_ID);
    const topic = (await db.doc(`users/${uid}/talkTopics/${req.topicId}`).get()).data() as { title?: string } | undefined;
    if (!topic) throw new HttpsError("not-found", "Topic not found.");
    if (!(await takeAiCall(db, uid))) throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    try {
      const raw = await generateStructuredJson([{ role: "user", parts: [{ text: buildHintPrompt(req, topic.title ?? "") }] }], HINT_SCHEMA, {
        timeoutMs: GEMINI_TIMEOUT_MS,
        temperature: 0.3, label: "talkHint"
      });
      return { hints: parseHints(raw) };
    } catch (e) {
      if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
      console.error("[talkHint] failed", e instanceof Error ? e.message : String(e));
      throw new HttpsError("internal", "Could not get hints, try again.");
    }
  }
);
