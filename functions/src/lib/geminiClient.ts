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

import { GoogleGenAI, type Content } from "@google/genai";
import { SHADOWING_ANALYSIS_RESPONSE_SCHEMA } from "../prompts/shadowingAnalysisPrompt";

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
 * Model used for shadowing pattern analysis. Defaults to gemini-3.8-flash -
 * the one model every app in this workspace now runs on. Override with
 * GEMINI_MODEL if a spike needs a different one.
 */
export function getShadowingModelId(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

/**
 * One structured-output call for the shadowing analysis. Returns the raw JSON
 * text (or undefined when the response has no text part); parsing and shape
 * checks stay with the caller. A timeout rejects with an AbortError.
 */
export async function generateShadowingJson(
  contents: Content[],
  timeoutMs: number
): Promise<string | undefined> {
  const response = await getGenAI().models.generateContent({
    model: getShadowingModelId(),
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: SHADOWING_ANALYSIS_RESPONSE_SCHEMA,
      temperature: 0.2,
      httpOptions: { timeout: timeoutMs },
    },
  });
  return response.text;
}
