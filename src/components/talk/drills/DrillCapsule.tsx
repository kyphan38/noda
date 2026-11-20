'use client';

import { useEffect, useState } from 'react';

import { TimedRecorder } from '@/components/talk/drills/TimedRecorder';
import { blobToBase64 } from '@/lib/speakingCheck';
import { CAPSULE_PROMPT, CAPSULE_SECONDS, capsuleDue, monthKey, roundNumbers, type TalkCapsule } from '@/lib/talk/drills';
import { getTalkStore } from '@/lib/talk/store';

/** The same one-minute talk every month, kept as audio, so you can hear yourself improve. */
export function DrillCapsule() {
  const [rows, setRows] = useState<TalkCapsule[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read once: render must not call the clock.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .listCapsules()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const send = async (blob: Blob) => {
    setBusy(true);
    setError(null);
    try {
      const store = getTalkStore();
      const r = await store.speech({ mode: 'transcribe', source: '', recording: await blobToBase64(blob), recordingMimeType: blob.type || 'audio/webm' });
      const row = await store.saveCapsule(monthKey(Date.now()), blob, r.seconds, r.transcript);
      setRows((x) => [...(x ?? []).filter((c) => c.month !== row.month), row].sort((a, b) => a.month.localeCompare(b.month)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the recording.');
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <p className="breathe text-sm text-gray-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-base text-gray-100">{CAPSULE_PROMPT}</p>
      {capsuleDue(rows, now) ? (
        <>
          <TimedRecorder limit={CAPSULE_SECONDS} busy={busy} onBlob={(b) => void send(b)} />
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </>
      ) : (
        <p className="text-center text-sm text-gray-500">This month is saved. Come back next month.</p>
      )}
      {rows.length > 0 && (
        <ul className="space-y-3">
          {[...rows].reverse().map((c) => {
            const n = roundNumbers(c.transcript, c.seconds);
            return (
              <li key={c.month} className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-gray-100">{c.month}</span>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {n.words} words · {n.wpm} words/min · {n.fillers} uh/um
                  </span>
                </div>
                <audio controls preload="none" src={c.url} className="w-full" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
