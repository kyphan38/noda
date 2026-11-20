/**
 * Talk eval: does talkTurn keep the learner's mistakes in the transcript, and
 * do its fixes agree with the corrected version? macOS `say` reads sentences
 * with known mistakes, each goes through the real talkTurn prompt and schema.
 *
 * Run from functions/ (uses the emulator key, never printed):
 *   npx tsx --env-file=.secret.local scripts/talk-eval.ts
 * About 7 Gemini calls. Prints one line per case and a pass count.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import * as os from "os";
import * as path from "path";

import { generateStructuredJson } from "../src/lib/geminiClient";
import { buildTurnPrompt, checkTurnRequest, parseTurnResult, type TurnResult } from "../src/lib/talkTurn";
import { TURN_SCHEMA } from "../src/lib/talkTurnSchema";

type Case = { say: string; keep: string[]; clean?: boolean };

const CASES: Case[] = [
  { say: "Yesterday I go to the office and I meet my manager.", keep: ["i go", "i meet"] },
  { say: "We have many problem with the deploy since three days.", keep: ["many problem", "since three days"] },
  { say: "She don't know the root cause yet.", keep: ["she don't"] },
  { say: "I am working here since two years.", keep: ["i am working here since two years"] },
  { say: "Can you explain me how the cache work?", keep: ["explain me", "cache work"] },
  { say: "We rolled back the release and the errors stopped.", keep: ["we rolled back the release"], clean: true },
];

const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** Lowercase words only; "3" and "three" count as the same. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(10|[0-9])\b/g, (d) => NUMBERS[Number(d)])
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function speak(text: string, dir: string, i: number): string {
  const file = path.join(dir, `case-${i}.wav`);
  execFileSync("say", ["-v", "Samantha", "--file-format=WAVE", "--data-format=LEI16@16000", "-o", file, text]);
  return file;
}

async function run(c: Case, wav: string): Promise<{ ok: boolean; notes: string[]; r: TurnResult }> {
  const req = checkTurnRequest({ topicId: "eval-b2", scenarioId: "s0", aiLine: "What happened at work yesterday?", replyKind: "question" });
  const prompt = buildTurnPrompt(req, {
    level: "B2",
    topicTitle: "Daily standup",
    persona: { name: "Dana", role: "Engineering manager", style: "Calm and direct." },
    targets: [],
    facts: [],
  });
  const raw = await generateStructuredJson(
    [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: "audio/wav", data: readFileSync(wav).toString("base64") } }] }],
    TURN_SCHEMA,
    { timeoutMs: 60000, temperature: 0.3, label: "talkEval" }
  );
  const r = parseTurnResult(raw, []);
  const notes: string[] = [];
  const t = norm(r.transcript);
  for (const k of c.keep) if (!t.includes(norm(k))) notes.push(`fixed in transcript: "${k}"`);
  const correct = norm(r.review.correct);
  for (const f of r.review.fixes) {
    if ((f.kind === "grammar" || f.kind === "word") && !correct.includes(norm(f.right))) notes.push(`fix not in Correct: "${f.right}"`);
  }
  if (c.clean) {
    const real = r.review.fixes.filter((f) => f.kind === "grammar" || f.kind === "word");
    if (real.length > 0) notes.push(`correct sentence got ${real.length} grammar/word fix(es)`);
  }
  return { ok: notes.length === 0, notes, r };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("No GEMINI_API_KEY: run with --env-file=.secret.local from functions/.");
  const dir = mkdtempSync(path.join(os.tmpdir(), "talk-eval-"));
  let pass = 0;
  try {
    for (const [i, c] of CASES.entries()) {
      const { ok, notes, r } = await run(c, speak(c.say, dir, i));
      if (ok) pass++;
      console.log(`${ok ? "PASS" : "FAIL"}  said: "${c.say}"`);
      console.log(`      heard: "${r.transcript}"`);
      console.log(`      correct: "${r.review.correct}"  fixes: ${r.review.fixes.map((f) => `${f.wrong} -> ${f.right}`).join("; ") || "none"}`);
      for (const n of notes) console.log(`      ! ${n}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${pass}/${CASES.length} passed`);
  process.exitCode = pass === CASES.length ? 0 : 1;
}

void main();
