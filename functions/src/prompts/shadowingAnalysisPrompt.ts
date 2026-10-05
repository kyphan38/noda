/**
 * Prompt + response-schema builder for the shadowing pattern analysis feature.
 *
 * Colocated on purpose (schema describes exactly what the prompt asks for) -
 * mirrors cogi's convention of one file per exercise type under
 * web/src/lib/ai/prompts/*.ts.
 *
 * v2 (current): one `chunks` + `notes` structure replacing v1's four parallel
 * sections. v1 asked for stress, intonation, connected speech and chunking as
 * independent blocks with their own prose summaries; the panel showed them as
 * four tabs, which forced the learner to re-assemble one sentence in their head.
 * v2 asks for the same information shaped the way it is displayed: one annotated
 * line (stress per token, tone per chunk, chunk boundaries) plus a short ranked
 * list of what actually differs from careful word-by-word reading.
 *
 * Every instruction below that looks oddly specific came out of a spike over 5
 * real sentences:
 * - The "Bad/Good" example must carry full Vietnamese diacritics. An earlier
 *   draft wrote it unaccented and Gemini copied that, returning unaccented
 *   Vietnamese for a whole sentence.
 * - The `why` cap is 12 words. At 15 the model regularly returned 16-17.
 * - Numbers must be spelled out in `notes[].text`, otherwise a note about
 *   "24 hours" quotes digits while its pseudo-spelling covers only "four hours".
 * - `via` exists because a multi-step reduction looked wrong without its middle
 *   step: "I'm going to" -> "ai-muh" reads like an error until "I'm gonna" sits
 *   between them.
 * - `sounds` is English-style respelling only. The old wording ("a pseudo-spelling
 *   a Vietnamese reader can say") made Gemini mix styles, e.g. "li-đồ" next to
 *   "sheh-ruh". Vietnamese tone marks add a pitch the speaker never used, and "đ"
 *   is not a flap, so the panel coached the wrong sound.
 */

import { Type, type Schema } from "@google/genai";

/** Keep in sync with `SHADOWING_MAX_NOTES` in constants/index.tsx. */
export const MAX_NOTES = 6;

export const SHADOWING_ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    chunks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tokens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                w: { type: Type.STRING },
                display: { type: Type.STRING },
                level: {
                  type: Type.STRING,
                  format: "enum",
                  enum: ["strong", "normal", "weak"],
                },
                linked: { type: Type.BOOLEAN },
              },
              required: ["w", "display", "level"],
            },
          },
          tone: {
            type: Type.STRING,
            format: "enum",
            enum: ["rise", "fall", "fall-rise", "rise-fall", "flat"],
          },
          toneStrength: { type: Type.STRING, format: "enum", enum: ["strong", "weak"] },
        },
        required: ["tokens", "tone", "toneStrength"],
      },
    },
    notes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            format: "enum",
            enum: ["linking", "reduction", "elision", "assimilation", "rhythm"],
          },
          text: { type: Type.STRING },
          via: { type: Type.STRING },
          sounds: { type: Type.STRING },
          ipa: { type: Type.STRING },
          why: { type: Type.STRING },
        },
        required: ["type", "text", "sounds", "ipa", "why"],
      },
    },
  },
  required: ["chunks", "notes"],
};

export function buildShadowingAnalysisPrompt(sourceText: string): string {
  return `You are a shadowing coach. The learner is Vietnamese, already comfortable reading IPA and familiar with phonetics terms. Their goal is NOT to learn the theory - it is to sound like this speaker. Coach the imitation.

Transcript of this exact clip: "${sourceText}"

Listen to the ACTUAL AUDIO. Describe only what this speaker really did in this recording, never how the sentence "should" be read.

## chunks
Split the sentence into thought groups exactly where this speaker grouped words together (breath, pause, or pitch reset). Keep the words in transcript order; every word of the transcript must appear exactly once across all chunks.

For each token:
- "w": the word exactly as written in the transcript, including any attached punctuation.
- "display": the SAME characters as "w", only the letter case may differ. For level "strong", uppercase the letters of the stressed syllable only (e.g. w "manager" -> display "MANager"; w "rules" -> display "RULES"). For "normal" and "weak", repeat "w" unchanged. Never add, drop, or change a letter.
- "level": "strong" = audibly stressed (pitch/length/loudness peak). "normal" = fully pronounced but not a peak. "weak" = audibly reduced, shortened, or swallowed. Only function words (articles, prepositions, auxiliaries, pronouns, conjunctions) may be "weak" - a content word is never "weak".
- "linked": true only if this word takes part in one of the "notes" below.

Per chunk also give "tone" (the pitch movement at the end of that chunk) and "toneStrength": "strong" for a clear, committed move, "weak" for a slight continuation rise or a small drop.

## notes
Work through the sentence from left to right and cover EVERY junction where the audio differs from a careful word-by-word reading: consonant-to-vowel links, weak forms of function words, swallowed or unreleased stops, assimilated sounds. List them in the order they occur in the sentence, at most ${MAX_NOTES}.
- The learner wants the full picture of what makes this sound native, not only the single most dramatic moment. A short sentence can legitimately produce 5-6 notes; do not stop at two or three because the rest feel small.
- If you hear more than ${MAX_NOTES} junctions, drop the ones that change the sound least - not the ones at the end of the sentence - and keep the rest in sentence order.
- Even so, only what is actually audible in THIS recording. Never invent a textbook rule the speaker did not apply, and if the speaker really does articulate a junction cleanly, leave it out - an empty array is a valid answer.
- At most ONE note of type "rhythm" (about timing, pauses, or pitch), placed last, and only if it changes how the learner should deliver the line.
- For sound notes ("linking", "reduction", "elision", "assimilation"): "text" = the exact words from the transcript, but if the transcript writes a number in digits, write the spoken words instead (e.g. transcript "24 hours" -> text "twenty-four hours"), "sounds" = an English-style respelling: plain ASCII letters only, syllables split by hyphens, the stressed syllable in CAPS (e.g. "HAD-tuh", "LIH-dl", "TID-bit", "SHEH-ruh"). Never use Vietnamese spelling or any diacritics in "sounds" - no "đ", no tone marks, no "li-đồ" or "thít-bịt": Vietnamese tones and letters carry sounds English does not have. "ipa" = the narrow IPA of what you actually hear. For "rhythm" notes leave "text", "via", "sounds", "ipa" as empty strings.
- "via": when the change happens in steps, the intermediate spoken form in ordinary English spelling, so the learner can follow the path (e.g. text "I'm going to" -> via "I'm gonna" -> sounds "AIM-uh"; text "want to" -> via "wanna"). Use only a widely known informal form. Empty string when the change is a single step.

## "why" field - the coaching instruction
Write in Vietnamese, keeping English words/IPA/phonetics terms as-is. Do NOT explain what the phenomenon is or name the rule - the learner already knows. Tell them what to DO with their mouth, tongue, or breath to copy it. Imperative, concrete, at most 12 words, one sentence. Write proper Vietnamese with full diacritics (tone marks) - never unaccented Vietnamese. Never use the em dash character; use a comma or a colon instead.
Bad (explains theory): "/d/ bị mất tiếng bật và 'to' giảm thành schwa."
Good (coaches action): "Đừng bật /d/: chạm lưỡi rồi trượt thẳng sang 'tuh', gọn trong một nhịp."

Respond only in the requested JSON structure.`;
}
