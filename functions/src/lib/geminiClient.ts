/**
 * Thin Gemini client wrapper — mirrors cogi's model-getter pattern
 * (web/src/lib/ai/gemini.ts): same SDK, same call shape, lazily reads the
 * API key from env (bound as a Cloud Functions secret at deploy time, never
 * committed — see functions/.env.example).
 */

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai"; // ^0.24.1, same version as cogi
import { SHADOWING_ANALYSIS_RESPONSE_SCHEMA } from "../prompts/shadowingAnalysisPrompt";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY env var.");
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Model used for shadowing pattern analysis. Defaults to gemini-3.8-flash —
 * the one model every app in this workspace now runs on. Override with
 * GEMINI_MODEL if a spike needs a different one.
 */
export function getShadowingModel(): GenerativeModel {
  const modelId = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  return getGenAI().getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SHADOWING_ANALYSIS_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });
}
