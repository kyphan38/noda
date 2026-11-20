// Sums Gemini cost from Cloud Functions logs, per function.
// Usage: firebase functions:log --lines 2000 | npx tsx scripts/gemini-cost.ts
import { readFileSync } from 'fs';
import { totalUsage } from '../functions/src/lib/geminiUsage';

const USD_TO_VND = 26_000;

const rows = totalUsage(readFileSync(0, 'utf8').split('\n'));
let sum = 0;
for (const r of rows) {
  sum += r.usd;
  console.log(`${r.label.padEnd(16)} ${String(r.calls).padStart(5)} calls  in ${r.input}  out ${r.output}  thinking ${r.thoughts}  $${r.usd.toFixed(4)}`);
}
console.log(`total            $${sum.toFixed(4)}  (about ${Math.round(sum * USD_TO_VND).toLocaleString('en-US')} VND)`);
