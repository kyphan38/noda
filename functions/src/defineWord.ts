/**
 * Word card (N3): IPA, part of speech and a simple English meaning of one word in
 * one sentence. Cached per word + sentence in users/{uid}/words, so a second tap is
 * free (no model call, not counted in the daily cap).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type, type Schema } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { generateStructuredJson, getShadowingModelId } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import { buildWordPrompt, checkWordRequest, parseWordCard, wordKey, type WordCard } from "./lib/wordCard";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 20000;

const WORD_CARD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    ipa: { type: Type.STRING },
    partOfSpeech: { type: Type.STRING },
    meaning: { type: Type.STRING },
  },
  required: ["ipa", "partOfSpeech", "meaning"],
};

export const defineWord = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    timeoutSeconds: 60,
  },
  async (request): Promise<WordCard> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }
    const uid = request.auth.uid;
    let req;
    try {
      req = checkWordRequest(request.data);
    } catch (e) {
      throw new HttpsError("invalid-argument", e instanceof Error ? e.message : "Bad request.");
    }

    const db = getFirestore(getApp(), NODA_DB_ID);
    const ref = db.doc(`users/${uid}/words/${wordKey(req)}`);
    const cached = await ref.get();
    if (cached.exists) {
      const d = cached.data() as WordCard;
      return { word: d.word, ipa: d.ipa, partOfSpeech: d.partOfSpeech, meaning: d.meaning };
    }

    if (!(await takeAiCall(db, uid))) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    }
    let card: WordCard;
    try {
      const raw = await generateStructuredJson([{ role: "user", parts: [{ text: buildWordPrompt(req) }] }], WORD_CARD_SCHEMA, {
        timeoutMs: GEMINI_TIMEOUT_MS,
        temperature: 0,
      });
      card = parseWordCard(raw, req.word);
    } catch (e) {
      if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
      // The error only: never the sentence.
      console.error("[defineWord] failed", e instanceof Error ? e.message : String(e));
      throw new HttpsError("unavailable", "Could not look up the word.");
    }
    await ref.set({ ...card, sentence: req.sentence, model: getShadowingModelId(), createdAt: FieldValue.serverTimestamp() });
    return card;
  }
);
