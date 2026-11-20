/**
 * Talk eval, part 2: the other prompts against the real model.
 * - topic: phrases fit the fill-the-blank drill, meanings do not give the
 *   phrase away, scenarios have facts, idea notes are short.
 * - kinds: a "share" line asks nothing, an "invite" line asks you to ask,
 *   a "question" line asks.
 * - retell: a point left out on purpose is marked as missed.
 * - hint: short chunks, never a full answer.
 *
 * Run from functions/ (uses the emulator key, never printed):
 *   npx tsx --env-file=.secret.local scripts/talk-eval-prompts.ts
 * About 6 Gemini calls.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import * as os from "os";
import * as path from "path";

import { generateStructuredJson } from "../src/lib/geminiClient";
import { HINT_SCHEMA, SPEECH_SCHEMA, TOPIC_SCHEMA } from "../src/lib/talkSchemas";
import { buildHintPrompt, checkHintRequest, parseHints } from "../src/lib/talkHint";
import { buildSpeechPrompt, checkSpeechRequest, parseSpeech } from "../src/lib/talkSpeech";
import { buildTopicPrompt, checkTopicRequest, parseTopicContent } from "../src/lib/talkTopic";
import { buildTurnPrompt, checkTurnRequest, parseTurnResult, type ReplyKind } from "../src/lib/talkTurn";
import { TURN_SCHEMA } from "../src/lib/talkTurnSchema";

const OPTS = { timeoutMs: 90000, temperature: 0.3, label: "talkEval" };
let failures = 0;
function report(name: string, checks: [string, boolean][]) {
  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length) failures++;
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${name}`);
  for (const [what, ok] of checks) console.log(`      ${ok ? "ok" : "!!"} ${what}`);
}

function sayWav(text: string, dir: string, name: string): string {
  const file = path.join(dir, `${name}.wav`);
  execFileSync("say", ["-v", "Samantha", "--file-format=WAVE", "--data-format=LEI16@16000", "-o", file, text]);
  return file;
}
const audio = (file: string) => ({ inlineData: { mimeType: "audio/wav", data: readFileSync(file).toString("base64") } });

async function evalTopic() {
  const req = checkTopicRequest({ topicId: "eval-incident-b2", kind: "preset", presetId: "incident", title: "Production incident", description: "Report an outage on a call: impact, cause, the fix and next steps.", level: "B2" });
  const c = parseTopicContent(await generateStructuredJson([{ role: "user", parts: [{ text: buildTopicPrompt(req) }] }], TOPIC_SCHEMA, OPTS));
  const n = c.phrases.length;
  const cloze = c.phrases.filter((p) => p.example.toLowerCase().includes(p.text.toLowerCase())).length;
  // A meaning gives the phrase away when it repeats the phrase's main word.
  const mainWord = (t: string) => t.toLowerCase().split(/\s+/).filter((w) => w.length > 3).sort((a, b) => b.length - a.length)[0];
  const leaks = c.phrases.filter((p) => {
    const w = mainWord(p.text);
    return w && p.meaning.toLowerCase().includes(w);
  });
  const longIdeas = c.scenarios.flatMap((s) => s.ideas).filter((i) => i.split(/\s+/).length > 6);
  console.log(`      sample: "${c.phrases[0]?.text}" = ${c.phrases[0]?.meaning} | ${c.phrases[0]?.example}`);
  report("topic", [
    [`${n} phrases (want at least 35)`, n >= 35],
    [`${cloze}/${n} examples contain the phrase word for word (want 80%)`, cloze / n >= 0.8],
    [`${leaks.length} meanings repeat the phrase's main word (want at most 10%)${leaks.length ? `: ${leaks.slice(0, 3).map((p) => p.text).join(", ")}` : ""}`, leaks.length / n <= 0.1],
    [`${c.scenarios.length} scenarios with 3-4 facts each`, c.scenarios.length === 5 && c.scenarios.every((s) => s.facts.length >= 3)],
    [`${longIdeas.length} idea notes over 6 words`, longIdeas.length === 0],
  ]);
}

async function evalKinds(dir: string) {
  const wav = sayWav("We fixed the build yesterday, and the release is still on Friday.", dir, "kinds");
  const ctx = { level: "B2" as const, topicTitle: "Daily standup", persona: { name: "Dana", role: "Engineering manager", style: "Calm and direct." }, targets: [], facts: [] };
  for (const kind of ["share", "invite", "question"] as ReplyKind[]) {
    const req = checkTurnRequest({ topicId: "eval-b2", scenarioId: "s0", aiLine: "How is the release going?", replyKind: kind });
    const r = parseTurnResult(await generateStructuredJson([{ role: "user", parts: [{ text: buildTurnPrompt(req, ctx) }, audio(wav)] }], TURN_SCHEMA, OPTS), []);
    const t = r.reply.text;
    const check: [string, boolean] =
      kind === "share"
        ? ["shares and asks nothing (no '?')", !t.includes("?")]
        : kind === "invite"
          ? ["invites the learner to ask", /\b(ask|questions?|anything (you|on your mind)|curious)\b/i.test(t)]
          : ["asks a question", t.includes("?")];
    report(`kind ${kind}: "${t}"`, [check]);
  }
}

async function evalRetell(dir: string) {
  const source =
    "Yesterday at 3 pm the payment service went down for 25 minutes. The cause was an expired TLS certificate on the load balancer. We renewed it by hand and added an alert that fires 14 days before expiry.";
  // Leaves out the alert on purpose.
  const wav = sayWav("So yesterday the payment service was down for about twenty five minutes, because a certificate expired, and we renewed it.", dir, "retell");
  const req = checkSpeechRequest({ mode: "retell", source });
  const r = parseSpeech(await generateStructuredJson([{ role: "user", parts: [{ text: buildSpeechPrompt(req) }, audio(wav)] }], SPEECH_SCHEMA, OPTS), "retell");
  const missed = r.points.filter((p) => !p.covered);
  report("retell", [
    [`${r.points.length} key points`, r.points.length >= 3],
    [`missed: ${missed.map((p) => p.point).join("; ") || "none"}`, missed.some((p) => /alert|14|expir|monitor/i.test(p.point))],
    [`covered the outage`, r.points.some((p) => p.covered && /down|outage|25|payment/i.test(p.point))],
  ]);
}

async function evalHint() {
  const req = checkHintRequest({ topicId: "eval-b2", aiLine: "Why did the API get so slow?", idea: "database slow because too many users at same time" });
  const hints = parseHints(await generateStructuredJson([{ role: "user", parts: [{ text: buildHintPrompt(req, "Production incident") }] }], HINT_SCHEMA, OPTS));
  report(`hint: ${hints.map((h) => `"${h.text}"`).join(", ")}`, [
    [`${hints.length} chunks (want 2-3)`, hints.length >= 2],
    ["no chunk is a full sentence", hints.every((h) => !/[.!?]$/.test(h.text) && h.text.split(/\s+/).length <= 6)],
  ]);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("No GEMINI_API_KEY: run with --env-file=.secret.local from functions/.");
  const dir = mkdtempSync(path.join(os.tmpdir(), "talk-eval-"));
  try {
    await evalTopic();
    await evalKinds(dir);
    await evalRetell(dir);
    await evalHint();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} section(s) failed` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
}

void main();
