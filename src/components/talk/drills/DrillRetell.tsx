'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';

import { TimedRecorder } from '@/components/talk/drills/TimedRecorder';
import type { SpeechResult } from '@/lib/db';
import { blobToBase64 } from '@/lib/speakingCheck';
import { RETELL_SECONDS } from '@/lib/talk/drills';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';

type Step = 'paste' | 'read' | 'speak' | 'done';

/**
 * Paste a Slack thread, a PR or an article; read it; then tell it from memory. Key points are checked.
 * With `source` (a lesson part) there is no paste step and the text starts hidden: you just heard it.
 */
export function DrillRetell({ source }: { source?: string } = {}) {
  const [text, setText] = useState(source ?? '');
  const [step, setStep] = useState<Step>(source ? 'read' : 'paste');
  const [showText, setShowText] = useState(!source);
  const [result, setResult] = useState<SpeechResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (blob: Blob) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await getTalkStore().speech({ mode: 'retell', source: text.trim(), recording: await blobToBase64(blob), recordingMimeType: blob.type || 'audio/webm' }));
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check the retell.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'paste')
    return (
      <div className="space-y-2">
        <textarea
          value={text}
          maxLength={4000}
          rows={8}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Paste a Slack thread, a PR description or a short article"
          className="w-full resize-y rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={() => (text.trim().length < 40 ? setError('Paste a bit more text first.') : setStep('read'))}
          className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white"
        >
          Read it
        </button>
      </div>
    );

  if (step === 'read')
    return (
      <div className="space-y-3">
        {showText ? (
          <p className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-200">{text}</p>
        ) : (
          <button type="button" onClick={() => setShowText(true)} className="w-full rounded-lg border border-gray-800 py-2 text-sm text-gray-400 hover:bg-gray-100/[0.06]">
            Show text
          </button>
        )}
        <button type="button" onClick={() => setStep('speak')} className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white">
          {source ? 'Tell it' : 'Hide it and tell me'}
        </button>
      </div>
    );

  if (step === 'speak' || !result)
    return (
      <div>
        <p className="text-center text-sm text-gray-300">{source ? 'Tell a friend what you heard, in your own words.' : 'Tell a colleague what it says, in your own words.'}</p>
        <TimedRecorder limit={RETELL_SECONDS} busy={busy} onBlob={(b) => void send(b)} />
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    );

  const covered = result.points.filter((p) => p.covered).length;
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">
          Key points <span className="ml-1 text-xs text-gray-500 tabular-nums">{covered}/{result.points.length}</span>
        </h2>
        <ul className="space-y-1 rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm">
          {result.points.map((p) => (
            <li key={p.point} className={p.covered ? 'text-gray-100' : 'text-gray-500'}>
              {p.covered ? '✓' : '✗'} {p.point}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm">
        <p className="text-xs text-gray-500">You said</p>
        <p className="text-gray-100">{result.transcript}</p>
        <p className="pt-2 text-xs text-gray-500">A natural retell</p>
        <p className="flex gap-2 text-gray-100">
          <button type="button" aria-label="Play" onClick={() => speak(result.model)} className="mt-0.5 self-start text-gray-500 hover:text-gray-100">
            <Volume2 className="h-4 w-4" />
          </button>
          {result.model}
        </p>
      </section>
      {result.fixes.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm">
          {result.fixes.map((f, i) => (
            <li key={i}>
              <span className="text-gray-500 line-through">{f.wrong}</span>
              <span className="mx-1.5 text-gray-500">→</span>
              <span className="font-medium text-gray-100">{f.right}</span>
              {f.why && <span className="block text-xs text-gray-400">{f.why}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep('speak')} className="flex-1 rounded-lg border border-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-100/[0.06]">
          Tell it again
        </button>
        {!source && (
          <button
            type="button"
            onClick={() => {
              setText('');
              setResult(null);
              setStep('paste');
            }}
            className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white"
          >
            New text
          </button>
        )}
      </div>
    </div>
  );
}
