'use client';

import { useState } from 'react';

import { TimedRecorder } from '@/components/talk/drills/TimedRecorder';
import { blobToBase64 } from '@/lib/speakingCheck';
import { DRILL_QUESTIONS, ROUND_SECONDS, roundNumbers, type RoundNumbers } from '@/lib/talk/drills';
import { getTalkStore } from '@/lib/talk/store';

/** kept: main points of round 1 still said (rounds 2 and 3 only). */
type Round = RoundNumbers & { transcript: string; kept?: { covered: number; total: number } };

/** One question, answered 3 times in 60, 45 and 30 seconds: faster, with fewer pauses, same main points. */
export function Drill432() {
  const [qi, setQi] = useState(() => Math.floor(Math.random() * DRILL_QUESTIONS.length));
  const [own, setOwn] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const question = own.trim() || DRILL_QUESTIONS[qi];
  const round = rounds.length;

  const send = async (blob: Blob) => {
    setBusy(true);
    setError(null);
    try {
      // Later rounds are checked against round 1's own points, in the same call.
      const first = rounds[0]?.transcript;
      const r = await getTalkStore().speech({
        mode: first ? 'retell' : 'transcribe',
        source: first ?? '',
        recording: await blobToBase64(blob),
        recordingMimeType: blob.type || 'audio/webm',
      });
      const kept = first ? { covered: r.points.filter((p) => p.covered).length, total: r.points.length } : undefined;
      setRounds((x) => [...x, { ...roundNumbers(r.transcript, r.seconds), transcript: r.transcript, kept }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check this round.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <p className="text-base text-gray-100">{question}</p>
        {round === 0 && (
          <div className="flex gap-2">
            <input
              value={own}
              onChange={(e) => setOwn(e.target.value)}
              placeholder="Or type your own question"
              className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-transparent px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
            />
            <button type="button" onClick={() => setQi((qi + 1) % DRILL_QUESTIONS.length)} className="text-xs text-gray-500 hover:text-gray-100">
              Another
            </button>
          </div>
        )}
      </div>

      {round < ROUND_SECONDS.length ? (
        <div>
          <p className="text-center text-sm text-gray-300">
            Round {round + 1}/{ROUND_SECONDS.length}: say it all in {ROUND_SECONDS[round]} seconds
          </p>
          <TimedRecorder key={round} limit={ROUND_SECONDS[round]} busy={busy} onBlob={(b) => void send(b)} />
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setRounds([])} className="w-full rounded-lg border border-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-100/[0.06]">
          Start again
        </button>
      )}

      {rounds.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 font-normal">Round</th>
              <th className="font-normal">Words</th>
              <th className="font-normal">Words/min</th>
              <th className="font-normal">uh/um</th>
              <th className="font-normal">Points kept</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-gray-100">
            {rounds.map((r, i) => (
              <tr key={i} className="border-t border-gray-800">
                <td className="py-1.5">{ROUND_SECONDS[i]}s</td>
                <td>{r.words}</td>
                <td>{r.wpm}</td>
                <td>{r.fillers}</td>
                <td>{r.kept ? `${r.kept.covered}/${r.kept.total}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rounds.length > 0 && (
        <details className="text-sm text-gray-400">
          <summary className="cursor-pointer text-xs text-gray-500">What you said</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {rounds.map((r, i) => (
              <li key={i}>{r.transcript}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
