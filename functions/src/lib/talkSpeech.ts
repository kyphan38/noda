/**
 * Talk speech: the pure parts of `talkSpeech`, used by the longer drills.
 * - transcribe (4/3/2 drill, Time Capsule): the exact words only.
 * - retell (Read-to-Speak): the exact words, which key points of the source
 *   text were covered, a model retell and up to 3 fixes.
 */
import { LEARNER_ROLE } from "./talkTopic";
import { FIX_KINDS, FIX_PATTERNS, MAX_FIXES, type TalkFix } from "./talkTurn";

export const SPEECH_MODES = ["transcribe", "retell"] as const;
export type SpeechMode = (typeof SPEECH_MODES)[number];
export const MAX_SOURCE = 4000;
export const MAX_POINTS = 6;

export interface SpeechRequest {
  mode: SpeechMode;
  source: string;
}

export interface SpeechResult {
  transcript: string;
  points: { point: string; covered: boolean }[];
  model: string;
  fixes: TalkFix[];
}

const line = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export function checkSpeechRequest(data: unknown): SpeechRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const mode = SPEECH_MODES.find((m) => m === d.mode);
  if (!mode) throw new Error("Bad mode.");
  const source = typeof d.source === "string" ? d.source.trim() : "";
  if (mode === "retell" && !source) throw new Error("Paste the text to retell.");
  if (source.length > MAX_SOURCE) throw new Error("The text is too long.");
  return { mode, source: mode === "retell" ? source : "" };
}

export function buildSpeechPrompt(req: SpeechRequest): string {
  const transcriptRule = [
    "transcript: write EXACTLY what the learner said, word for word. Keep every mistake, repetition and filler (uh, um).",
    "Do NOT correct, improve or complete anything. If a word is not clear, write [unclear].",
  ];
  if (req.mode === "transcribe") {
    return [`The audio is ${LEARNER_ROLE} speaking English.`, ...transcriptRule, "Return points: [], model: \"\", fixes: []."].join("\n");
  }
  return [
    `${LEARNER_ROLE} read the text below, then retold it out loud from memory, as if telling a colleague. English only.`,
    `Text:\n"""\n${req.source}\n"""`,
    "The audio is the learner's retell.",
    ...transcriptRule,
    `points: the ${MAX_POINTS} or fewer key points of the text (each at most 12 words), and covered: true if the learner said it (in any words).`,
    "model: a short, natural spoken retell of the text that covers the key points, at most 80 words, at about B2 level.",
    `fixes: at most ${MAX_FIXES} of the learner's most useful language fixes (wrong: exact words from the transcript, right, why in at most 15 simple words, kind, pattern).`,
    `kind is one of ${FIX_KINDS.join(", ")}; pattern is one of ${FIX_PATTERNS.join(", ")}.`,
  ].join("\n");
}

export class SpeechShapeError extends Error {}

export function parseSpeech(raw: string | undefined, mode: SpeechMode): SpeechResult {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw ?? "") as Record<string, unknown>;
  } catch {
    throw new SpeechShapeError("Not JSON.");
  }
  const transcript = line(d.transcript, 6000);
  if (mode === "transcribe") return { transcript, points: [], model: "", fixes: [] };
  const points = (Array.isArray(d.points) ? d.points : [])
    .map((p) => ({ point: line((p as Record<string, unknown>)?.point, 160), covered: (p as Record<string, unknown>)?.covered === true }))
    .filter((p) => p.point)
    .slice(0, MAX_POINTS);
  if (points.length === 0) throw new SpeechShapeError("No key points.");
  const fixes: TalkFix[] = [];
  for (const f of Array.isArray(d.fixes) ? d.fixes : []) {
    const x = (f ?? {}) as Record<string, unknown>;
    const kind = FIX_KINDS.find((k) => k === x.kind);
    const wrong = line(x.wrong, 200);
    const right = line(x.right, 200);
    if (!kind || !wrong || !right || wrong.toLowerCase() === right.toLowerCase()) continue;
    fixes.push({ kind, wrong, right, why: line(x.why, 160), pattern: FIX_PATTERNS.find((p) => p === x.pattern) ?? "other" });
    if (fixes.length === MAX_FIXES) break;
  }
  return { transcript, points, model: line(d.model, 800), fixes };
}
