'use client';

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

import { TalkSayCheck } from '@/components/talk/TalkSayCheck';
import { checkParagraph, type ParagraphCheck } from '@/lib/paragraph-dictation';
import { progressId } from '@/lib/talk/phrase-stage';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkPhrase, TalkSession, TalkWrap } from '@/lib/talk/types';

type Props = { session: TalkSession; phrases: TalkPhrase[]; onWrap: (wrap: TalkWrap) => void };

/** Notes made once per talk: what to work on, missed chances, better words, and a 1-minute closing drill. */
export function TalkNotes({ session, phrases, onWrap }: Props) {
  const [wrap, setWrap] = useState<TalkWrap | null>(session.wrap ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wrap || session.turns.length === 0) return;
    let alive = true;
    const store = getTalkStore();
    const onThisSet = new Set(phrases.map((p) => progressId(session.topicId, p.id)));
    store
      .listPrompted()
      .catch(() => [])
      .then((rows) => {
        const known = rows
          .map((r) => ({ key: progressId(r.topicId, r.phraseId), text: r.text }))
          .filter((k) => !onThisSet.has(k.key));
        return store.wrapSession(session.id, known);
      })
      .then((w) => {
        if (!alive) return;
        setWrap(w);
        onWrap(w);
        void store.markActive(w.activeKeys).catch(() => {});
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not make the notes.'));
    return () => {
      alive = false;
    };
    // Once per talk: the notes are saved with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  if (session.turns.length === 0) return null;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!wrap) return <p className="breathe text-sm text-gray-500">Making your notes…</p>;

  const byId = new Map(phrases.map((p) => [p.id, p.text]));
  return (
    <div className="space-y-6">
      {wrap.focus && (
        <p className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 text-sm text-gray-100">
          <span className="mr-2 text-xs text-gray-500">Next time</span>
          {wrap.focus}
        </p>
      )}

      {wrap.missedChances.length > 0 && (
        <Section title="Missed chances">
          {wrap.missedChances.map((m, i) => (
            <li key={i} className="text-sm">
              <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-300">{byId.get(m.phraseId) ?? m.phraseId}</span>
              <span className="mt-1 block text-gray-500">{m.said}</span>
              <span className="block text-gray-100">{m.better}</span>
            </li>
          ))}
        </Section>
      )}

      {wrap.swaps.length > 0 && (
        <Section title="Better words">
          {wrap.swaps.map((s, i) => (
            <li key={i} className="text-sm">
              <span className="text-gray-500 line-through">{s.from}</span>
              <span className="mx-1.5 text-gray-500">→</span>
              <span className="font-medium text-gray-100">{s.to}</span>
              {s.why && <span className="block text-xs text-gray-400">{s.why}</span>}
            </li>
          ))}
        </Section>
      )}

      {wrap.closingPicks.length > 0 && <ClosingDrill picks={wrap.closingPicks} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">{title}</h2>
      <ul className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">{children}</ul>
    </section>
  );
}

/** Say the natural version of your weakest answers from a simple idea, from memory. */
function ClosingDrill({ picks }: { picks: TalkWrap['closingPicks'] }) {
  const [i, setI] = useState(0);
  const [result, setResult] = useState<ParagraphCheck | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const pick = picks[i];

  if (!pick) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Closing drill</h2>
        <p className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-100">
          Done. Average match <span className="tabular-nums">{avg}%</span>.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">
        Closing drill <span className="ml-1 text-xs text-gray-500 tabular-nums">{i + 1}/{picks.length}</span>
      </h2>
      <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <p className="text-base text-gray-100">{pick.idea}</p>
        {!result ? (
          <TalkSayCheck
            key={i}
            placeholder="Say it the natural way"
            onAnswer={(guesses) => {
              const best = guesses.map((g) => checkParagraph(g, pick.target)).sort((a, b) => b.percent - a.percent)[0];
              setResult(best);
              setScores((s) => [...s, best.percent]);
            }}
          />
        ) : (
          <>
            <p className="text-base leading-relaxed">
              {result.marks.map((m, k) => (
                <span key={k} className={m.ok ? 'text-gray-100' : 'rounded-sm bg-gray-700 px-0.5 text-gray-300'}>
                  {m.word}{' '}
                </span>
              ))}
              <span className="ml-1 text-sm text-gray-400 tabular-nums">{result.percent}%</span>
            </p>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => speak(pick.target)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-100">
                <Volume2 className="h-3.5 w-3.5" /> Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setI(i + 1);
                }}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-white"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
