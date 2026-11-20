/**
 * Talk topic: makes the phrase list, the persona and the opening line for one
 * topic at one level. Saved at users/{uid}/talkTopics/{topicId}, so a topic is
 * paid for once; a second call returns the saved copy.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type, type Schema } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generateStructuredJson, getShadowingModelId } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import { buildTopicPrompt, checkTopicRequest, parseTopicContent, TOPIC_VERSION, type TopicContent } from "./lib/talkTopic";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 90000;

const STR = { type: Type.STRING };
const TOPIC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    persona: { type: Type.OBJECT, properties: { name: STR, role: STR, style: STR }, required: ["name", "role", "style"] },
    opening: { type: Type.OBJECT, properties: { text: STR }, required: ["text"] },
    phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { text: STR, ipa: STR, meaning: STR, example: STR },
        required: ["text", "ipa", "meaning", "example"],
      },
    },
  },
  required: ["persona", "opening", "phrases"],
};

export const talkTopic = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }
    const uid = request.auth.uid;
    let req;
    try {
      req = checkTopicRequest(request.data);
    } catch (e) {
      throw new HttpsError("invalid-argument", e instanceof Error ? e.message : "Bad request.");
    }

    const db = getFirestore(getApp(), NODA_DB_ID);
    const ref = db.doc(`users/${uid}/talkTopics/${req.topicId}`);
    const cached = await ref.get();
    if (cached.exists) return { id: req.topicId, ...cached.data() };

    if (!(await takeAiCall(db, uid))) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    }
    const prompt = buildTopicPrompt(req);
    let content: TopicContent | null = null;
    // One retry on a malformed answer, as in the other functions.
    for (let attempt = 0; attempt < 2 && !content; attempt++) {
      try {
        const raw = await generateStructuredJson([{ role: "user", parts: [{ text: prompt }] }], TOPIC_SCHEMA, {
          timeoutMs: GEMINI_TIMEOUT_MS,
          temperature: 0.4,
        });
        content = parseTopicContent(raw);
      } catch (e) {
        if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
        console.error("[talkTopic] failed", attempt, e instanceof Error ? e.message : String(e));
      }
    }
    if (!content) throw new HttpsError("unavailable", "Could not make this topic. Try again.");

    const topic = {
      title: req.title,
      description: req.description,
      kind: req.kind,
      ...(req.presetId ? { presetId: req.presetId } : {}),
      level: req.level,
      ...content,
      model: getShadowingModelId(),
      version: TOPIC_VERSION,
      createdAt: Date.now(),
    };
    await ref.set(topic);
    return { id: req.topicId, ...topic };
  }
);
