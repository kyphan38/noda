/**
 * Vietnamese translation of lesson sentences. The client sends the asked sentence plus the
 * next ones (up to MAX_BATCH) so one model call covers many later taps. Cached per sentence
 * in users/{uid}/lessons/{lessonId}/translations/{sentenceId}; cached sentences cost nothing.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type, type Schema } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { generateStructuredJson, getShadowingModelId } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError, isGeminiTimeoutError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import {
  TRANSLATION_VERSION,
  buildTranslatePrompt,
  checkTranslateRequest,
  parseTranslations,
  usableCache,
  type CachedTranslation,
  type Translation,
} from "./lib/translate";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 45000;

export const TRANSLATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { id: { type: Type.INTEGER }, vi: { type: Type.STRING } },
        required: ["id", "vi"],
      },
    },
  },
  required: ["items"],
};

export const translateSentences = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    timeoutSeconds: 60,
  },
  async (request): Promise<{ items: Translation[] }> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }
    const uid = request.auth.uid;
    let req;
    try {
      req = checkTranslateRequest(request.data);
    } catch (e) {
      throw new HttpsError("invalid-argument", e instanceof Error ? e.message : "Bad request.");
    }

    const db = getFirestore(getApp(), NODA_DB_ID);
    const refs = req.items.map((it) => db.doc(`users/${uid}/lessons/${req.lessonId}/translations/${it.id}`));
    const snaps = await db.getAll(...refs);
    const found = new Map<number, string>();
    req.items.forEach((it, i) => {
      const vi = usableCache(snaps[i].data() as CachedTranslation | undefined, it.text);
      if (vi) found.set(it.id, vi);
    });
    const missing = req.items.filter((it) => !found.has(it.id));

    if (missing.length > 0) {
      if (!(await takeAiCall(db, uid))) {
        throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
      }
      const prompt = buildTranslatePrompt(req.title, missing, req.context);
      const ids = missing.map((it) => it.id);
      const call = async () => {
        const raw = await generateStructuredJson([{ role: "user", parts: [{ text: prompt }] }], TRANSLATE_SCHEMA, {
          timeoutMs: GEMINI_TIMEOUT_MS,
          temperature: 0.2,
          // Default thinking sometimes doubled the wait (18s vs 9s for 20 lines) with no better text.
          thinkingLow: true,
          label: "translate",
        });
        return parseTranslations(raw, ids);
      };
      let fresh: Translation[];
      try {
        try {
          fresh = await call();
        } catch (e) {
          // One retry on an unusable answer; a timeout already used the whole budget.
          if (isGeminiTimeoutError(e) || isGeminiQuotaError(e)) throw e;
          fresh = await call();
        }
      } catch (e) {
        if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
        if (isGeminiTimeoutError(e)) throw new HttpsError("deadline-exceeded", "Translation timed out, try again.");
        // The error only: never the sentences.
        console.error("[translateSentences] failed", e instanceof Error ? e.message : String(e));
        throw new HttpsError("unavailable", "Could not translate.");
      }

      const batch = db.batch();
      const model = getShadowingModelId();
      for (const t of fresh) {
        const it = missing.find((m) => m.id === t.id)!;
        found.set(t.id, t.vi);
        batch.set(db.doc(`users/${uid}/lessons/${req.lessonId}/translations/${t.id}`), {
          en: it.text,
          vi: t.vi,
          model,
          version: TRANSLATION_VERSION,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return { items: req.items.map((it) => ({ id: it.id, vi: found.get(it.id)! })) };
  }
);
