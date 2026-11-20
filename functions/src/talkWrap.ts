/**
 * Talk wrap: notes for a finished talk (missed chances, swaps, closing drill,
 * older phrases used without help). Reads the session the app saved, makes the
 * notes with one text-only model call, and saves them on the session as `wrap`.
 * A second call returns the saved notes: no model call, not counted.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Type, type Schema } from "@google/genai";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generateStructuredJson } from "./lib/geminiClient";
import { QUOTA_MESSAGE, isGeminiQuotaError, isGeminiTimeoutError } from "./lib/geminiErrors";
import { takeAiCall } from "./lib/dailyLimit";
import { buildWrapPrompt, checkWrapRequest, parseWrap, WrapShapeError, type TalkWrap, type WrapTurn } from "./lib/talkWrap";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";
const GEMINI_TIMEOUT_MS = 45000;

const STR = { type: Type.STRING };
const INT = { type: Type.INTEGER };
const WRAP_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    missedChances: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { turn: INT, phraseId: STR, said: STR, better: STR }, required: ["turn", "phraseId", "said", "better"] },
    },
    swaps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { from: STR, to: STR, why: STR }, required: ["from", "to", "why"] } },
    closingPicks: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { turn: INT, idea: STR, target: STR }, required: ["turn", "idea", "target"] },
    },
    activeKeys: { type: Type.ARRAY, items: STR },
    focus: STR,
  },
  required: ["missedChances", "swaps", "closingPicks", "activeKeys", "focus"],
};

type SessionDoc = {
  topicId?: string;
  setIndex?: number;
  wrap?: TalkWrap;
  turns?: { ai?: { text?: string }; transcript?: string; review?: { natural?: string }; usedPhraseIds?: string[] }[];
};
type TopicDoc = { phrases?: { id: string; text: string; setIndex: number; removed?: boolean }[] };

export const talkWrap = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY", "ALLOWED_USER_UID"],
    timeoutSeconds: 120,
  },
  async (request): Promise<TalkWrap> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) {
      throw new HttpsError("permission-denied", "This tool is single-user only.");
    }
    const uid = request.auth.uid;
    let req;
    try {
      req = checkWrapRequest(request.data);
    } catch (e) {
      throw new HttpsError("invalid-argument", e instanceof Error ? e.message : "Bad request.");
    }

    const db = getFirestore(getApp(), NODA_DB_ID);
    const sessionRef = db.doc(`users/${uid}/talkSessions/${req.sessionId}`);
    const session = (await sessionRef.get()).data() as SessionDoc | undefined;
    if (!session?.topicId) throw new HttpsError("not-found", "Talk not found.");
    if (session.wrap) return session.wrap;
    const turns: WrapTurn[] = (session.turns ?? []).map((t) => ({
      ai: t.ai?.text ?? "",
      you: t.transcript ?? "",
      natural: t.review?.natural ?? "",
    }));
    if (turns.length === 0) throw new HttpsError("failed-precondition", "This talk has no answers yet.");

    const topic = (await db.doc(`users/${uid}/talkTopics/${session.topicId}`).get()).data() as TopicDoc | undefined;
    const targets = (topic?.phrases ?? []).filter((p) => p.setIndex === session.setIndex && !p.removed).map((p) => ({ id: p.id, text: p.text }));
    const usedIds = (session.turns ?? []).flatMap((t) => t.usedPhraseIds ?? []);

    if (!(await takeAiCall(db, uid))) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    }
    const prompt = buildWrapPrompt(turns, targets, req.known, usedIds);
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          const raw = await generateStructuredJson([{ role: "user", parts: [{ text: prompt }] }], WRAP_SCHEMA, {
            timeoutMs: GEMINI_TIMEOUT_MS,
            temperature: 0.2, label: "talkWrap"
          });
          const wrap = parseWrap(
            raw,
            turns.length,
            targets.map((t) => t.id),
            req.known.map((k) => k.key)
          );
          await sessionRef.set({ wrap }, { merge: true });
          return wrap;
        } catch (e) {
          if (!(e instanceof WrapShapeError) || attempt >= 2) throw e;
          console.warn("[talkWrap] bad shape, retrying:", e.message);
        }
      }
    } catch (e) {
      if (isGeminiQuotaError(e)) throw new HttpsError("resource-exhausted", QUOTA_MESSAGE);
      if (isGeminiTimeoutError(e)) throw new HttpsError("deadline-exceeded", "That took too long, try again.");
      console.error("[talkWrap] failed", e instanceof Error ? e.message : String(e));
      throw new HttpsError("internal", "Could not make the notes, try again.");
    }
  }
);
