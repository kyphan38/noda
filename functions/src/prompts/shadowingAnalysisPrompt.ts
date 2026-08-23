/**
 * Prompt + response-schema builder for the shadowing pattern analysis feature.
 *
 * Colocated on purpose (schema describes exactly what the prompt asks for) —
 * mirrors cogi's convention of one file per exercise type under
 * web/src/lib/ai/prompts/*.ts, and reuses the exact prompt text validated in
 * the Stage 1 spike (see /Users/kyphan/.claude/plans/ok-v-y-b-y-gi-delegated-garden.md).
 */

import { SchemaType, type Schema } from "@google/generative-ai";

export const SHADOWING_ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    stressRhythm: {
      type: SchemaType.OBJECT,
      properties: {
        summary: { type: SchemaType.STRING },
        stressedWords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        notes: { type: SchemaType.STRING },
      },
      required: ["summary", "stressedWords"],
    },
    intonationPitch: {
      type: SchemaType.OBJECT,
      properties: {
        summary: { type: SchemaType.STRING },
        pattern: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["rising", "falling", "fall-rise", "rise-fall", "flat"],
        },
        notes: { type: SchemaType.STRING },
      },
      required: ["summary", "pattern"],
    },
    connectedSpeech: {
      type: SchemaType.OBJECT,
      properties: {
        summary: { type: SchemaType.STRING },
        features: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              type: {
                type: SchemaType.STRING,
                format: "enum",
                enum: ["linking", "reduction", "elision", "assimilation"],
              },
              example: { type: SchemaType.STRING },
              explanation: { type: SchemaType.STRING },
            },
            required: ["type", "example", "explanation"],
          },
        },
      },
      required: ["summary", "features"],
    },
    chunking: {
      type: SchemaType.OBJECT,
      properties: {
        summary: { type: SchemaType.STRING },
        groups: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        pauseNotes: { type: SchemaType.STRING },
      },
      required: ["summary", "groups"],
    },
  },
  required: ["stressRhythm", "intonationPitch", "connectedSpeech", "chunking"],
};

export function buildShadowingAnalysisPrompt(sourceText: string): string {
  return `You are an expert English pronunciation coach analyzing a short audio clip of a native/fluent speaker, explaining it to a Vietnamese learner.
The transcript of this exact clip is: "${sourceText}"

Listen carefully to the ACTUAL AUDIO provided (not generic textbook rules) and explain, based on what this specific speaker actually did in this specific recording.
1. Sentence stress & rhythm - which words are stressed and why, and the overall rhythmic pattern.
2. Intonation & pitch - how pitch rises/falls across the sentence, and what pattern it forms.
3. Connected speech - linking, reduction, elision, or assimilation actually heard in this clip, with concrete before/after examples grounded in the audio.
4. Chunking / thought groups - where the speaker pauses or groups words together, and why.

Give every observation on what is actually audible in the provided clip, not on how the sentence "should" theoretically be pronounced. If a feature (e.g. no strong connected-speech reduction) is absent, say so briefly rather than inventing one.

Language & style for every free-text field (summary, notes, explanation, pauseNotes):
- Write in Vietnamese. Keep English where it reads more naturally than a forced Vietnamese translation: quoted words/phrases from the transcript, IPA transcriptions, and established phonetics terms (e.g. "schwa", "linking", "stress-timed rhythm", "weak form"). Do not force-translate these into awkward Vietnamese.
- Each field must add NEW information, not restate another field. Concretely:
  - "summary" = one short sentence giving the overall pattern (not a list of examples).
  - "notes" = only extra detail not already said in "summary" or in "stressedWords"/"groups"/"pauseNotes". If there's nothing new to add, return an empty string instead of repeating "summary".
  - Never repeat the same word/phrase example across "summary" and "notes" of the same section.
- Keep every field concise: summary/notes/explanation each around 1 short sentence, not a paragraph.

Respond only in the requested JSON structure.`;
}
