/**
 * Thin Gemini client wrapper on the Google Gen AI SDK (`@google/genai`), which
 * replaced the deprecated `@google/generative-ai` (support ended 2025-08-31).
 * Lazily reads the API key from env (bound as a Cloud Functions secret at deploy
 * time, never committed - see functions/.env.example).
 *
 * The SDK does not retry on its own unless `retryOptions` is set, and it is left
 * unset on purpose: the caller owns the single retry on a malformed response, and
 * extra transport retries would blow the function's time budget.
 */

import { GoogleGenAI, MediaResolution, type Content, type Schema } from "@google/genai";
import { SHADOWING_ANALYSIS_RESPONSE_SCHEMA } from "../prompts/shadowingAnalysisPrompt";
import { summarizeUsage } from "./geminiUsage";

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY env var.");
  }
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

/**
 * Model used for shadowing pattern analysis. Stays on gemini-3.8-flash: on
 * real clips gemini-4-argon often ignored the audio and the transcript and
 * returned a made-up line ("the quick brown fox"), so no analysis passed the
 * shape check. Override with GEMINI_MODEL if a spike needs a different one.
 */
export function getShadowingModelId(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

/**
 * One structured-output call for the shadowing analysis. Returns the raw JSON
 * text (or undefined when the response has no text part); parsing and shape
 * checks stay with the caller. A timeout rejects with an AbortError.
 */
export function generateShadowingJson(
  contents: Content[],
  timeoutMs: number,
  /** For video input: low resolution keeps a YouTube clip near 100 tokens a second. */
  lowMediaResolution = false
): Promise<string | undefined> {
  return generateStructuredJson(contents, SHADOWING_ANALYSIS_RESPONSE_SCHEMA, {
    timeoutMs,
    lowMediaResolution,
    temperature: 0.2,
    label: "shadowing",
  });
}

/** Any structured-output call on the shadowing model. Same contract as above. */
export async function generateStructuredJson(
  contents: Content[],
  responseSchema: Schema,
  opts: { timeoutMs: number; lowMediaResolution?: boolean; temperature: number; label?: string }
): Promise<string | undefined> {
  const response = await getGenAI().models.generateContent({
    model: getShadowingModelId(),
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: opts.temperature,
      ...(opts.lowMediaResolution ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
      httpOptions: { timeout: opts.timeoutMs },
    },
  });
  // Cost log: numbers only. Read with `firebase functions:log | grep gemini-usage`.
  console.info("[gemini-usage]", JSON.stringify(summarizeUsage(opts.label ?? "other", response.usageMetadata, Date.now())));
  return response.text;
}
