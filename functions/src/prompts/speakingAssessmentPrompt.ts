/**
 * Prompt + response schema for the speaking check (record a segment, get feedback).
 *
 * Gemini only labels; the score is computed in lib/speakingScore.ts. Every question
 * is a closed one (which word index, yes/partly/no, a 1-5 level against a written
 * rubric) because closed answers repeat between runs and a free 0-100 number does not.
 * The checklist comes from the shadowing analysis of the same sentences, so the check
 * asks about exactly the habits the learner just practised.
 */

import { Type, type Schema } from "@google/genai";
import { MAX_FIXES } from "../lib/speakingScore";

export interface SpeakingChecklistItem {
  type: string;
  text: string;
  sounds: string;
  via: string;
}

/** Most sound notes a segment sends; more makes the reply slower and less careful. */
export const MAX_CHECKS = 8;

export const SPEAKING_ASSESSMENT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    wordIssues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          kind: { type: Type.STRING, format: "enum", enum: ["mispronounced", "missing"] },
          heard: { type: Type.STRING },
          tip: { type: Type.STRING },
        },
        required: ["index", "kind", "heard", "tip"],
      },
    },
    checks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          result: { type: Type.STRING, format: "enum", enum: ["yes", "partly", "no"] },
        },
        required: ["id", "result"],
      },
    },
    criteria: {
      type: Type.OBJECT,
      properties: {
        clarity: { type: Type.INTEGER },
        stress: { type: Type.INTEGER },
        intonation: { type: Type.INTEGER },
      },
      required: ["clarity", "stress", "intonation"],
    },
    fixes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          why: { type: Type.STRING },
        },
        required: ["text", "why"],
      },
    },
  },
  required: ["wordIssues", "checks", "criteria", "fixes"],
};

export function buildSpeakingAssessmentPrompt(
  words: string[],
  checklist: SpeakingChecklistItem[],
  hasReference: boolean
): string {
  const numbered = words.map((w, i) => `${i} ${w}`).join("\n");
  const checks = checklist.length
    ? checklist
        .map((c, i) => {
          const path = c.via ? ` (via "${c.via}")` : "";
          return `${i}. ${c.type}: "${c.text}"${path} -> sounds like "${c.sounds}"`;
        })
        .join("\n")
    : "(none - return an empty array)";
  const audioOrder = hasReference
    ? `You get two recordings, in this order:
1. REFERENCE: the original speaker saying this text.
2. LEARNER: a language learner shadowing the same text.
Judge only the LEARNER. Use the REFERENCE as the target sound.`
    : `You get one recording: a language learner reading this text aloud. Judge it against natural, fluent English.`;

  return `You are a strict but fair pronunciation examiner for a shadowing app.

${audioOrder}

## The text, one word per line with its index
${numbered}

## wordIssues
List ONLY the words the learner got wrong. A word that is understandable and close to the target is NOT an issue, even with an accent.
- "missing": the word is skipped or not audible at all. "heard" = "".
- "mispronounced": a different word is heard, or a sound is wrong enough to change or blur the word (e.g. "think" heard as "sink"). "heard" = what you actually heard, in plain English spelling.
- Use the index from the list above. At most one entry per word. An empty array is a valid answer.
- If the learner adds words or repeats themselves, ignore the extras.

## checks
Did the learner do each of these sound habits of the original speaker?
${checks}
For each item return its number as "id" and "result": "yes" (clearly done), "partly" (attempted, not quite), "no" (read word by word, or skipped).

## criteria
Give each a whole number 1-5 using this rubric only:
- clarity: 5 every word is easy to understand; 4 one or two words unclear; 3 several unclear words but the meaning comes through; 2 hard to follow; 1 mostly not understandable.
- stress: 5 the same words stand out as in the target, weak words stay light; 4 one or two stress slips; 3 stress often flat or on the wrong word; 2 almost every word given equal weight; 1 no stress pattern.
- intonation: 5 pitch rises and falls like the target; 4 small differences; 3 mostly flat or the wrong direction at the ends of phrases; 2 flat and monotone; 1 no recognisable phrasing.

## fixes
The ${MAX_FIXES} most useful things to fix next, most important first (fewer if the reading was good, empty if nothing matters).
- "text": the exact words from the text the fix is about.
- "why": one imperative sentence in plain, simple English, at most 12 words, telling the learner what to DO with mouth, tongue, or breath. Do not explain theory or name rules. Never use the em dash character.

Judge only what you hear. If the learner audio is silent or is clearly not this text, give 1 for every criterion and mark every word missing.

Respond only in the requested JSON structure.`;
}
