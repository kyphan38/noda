/** JSON shapes the Talk functions ask Gemini for. Shared by the handlers and scripts/talk-eval.ts. */
import { Type, type Schema } from "@google/genai";
import { FIX_KINDS, FIX_PATTERNS } from "./talkTurn";

const STR = { type: Type.STRING };

export const TOPIC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    persona: { type: Type.OBJECT, properties: { name: STR, role: STR, style: STR }, required: ["name", "role", "style"] },
    scenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: STR, facts: { type: Type.ARRAY, items: STR }, opening: STR, ideas: { type: Type.ARRAY, items: STR } },
        required: ["title", "facts", "opening", "ideas"],
      },
    },
    phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { text: STR, ipa: STR, meaning: STR, example: STR },
        required: ["text", "ipa", "meaning", "example"],
      },
    },
  },
  required: ["persona", "scenarios", "phrases"],
};

export const HINT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { hints: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: STR, use: STR }, required: ["text", "use"] } } },
  required: ["hints"],
};

export const SPEECH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    transcript: STR,
    points: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: STR, covered: { type: Type.BOOLEAN } }, required: ["point", "covered"] } },
    model: STR,
    fixes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { wrong: STR, right: STR, why: STR, kind: { type: Type.STRING, enum: [...FIX_KINDS] }, pattern: { type: Type.STRING, enum: [...FIX_PATTERNS] } },
        required: ["wrong", "right", "why", "kind", "pattern"],
      },
    },
  },
  required: ["transcript", "points", "model", "fixes"],
};
