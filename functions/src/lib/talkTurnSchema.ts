/** The JSON shape talkTurn asks Gemini for. Shared by the handler and scripts/talk-eval.ts. */
import { Type, type Schema } from "@google/genai";
import { FIX_KINDS, FIX_PATTERNS } from "./talkTurn";

const STR = { type: Type.STRING };
export const TURN_SCHEMA: Schema = {
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
