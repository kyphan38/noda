'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

import { TalkDrill } from '@/components/talk/TalkDrill';
import { TalkMatching } from '@/components/talk/TalkMatching';
import { matchingRounds } from '@/lib/talk/learn-queue';
import { addMisses, isUsableState, phraseSetKey, stateLabel, type LearnState } from '@/lib/talk/learn-state';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import type { PhraseStage, TalkPhrase, TalkPhraseProgress, TalkTopic } from '@/lib/talk/types';

type Step = 'cards' | 'match' | 'drill' | 'done';
const STEPS: { id: Step; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'match', label: 'Match' },
  { id: 'drill', label: 'Recall' },
];

type Props = {
  topic: TalkTopic;
  setIndex: number;
  progress: Map<string, TalkPhraseProgress>;
  onProgress: (m: Map<string, TalkPhraseProgress>) => void;
  onExit: () => void;
};

/** Learn one set: read the cards, match phrases to meanings, then recall each one until none is wrong. */
export function TalkLearn({ topic, setIndex, progress, onProgress, onExit }: Props) {
  const phrases = useMemo(() => topic.phrases.filter((p) => p.setIndex === setIndex && !p.removed), [topic.phrases, setIndex]);
  const [step, setStep] = useState<Step>('cards');
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  /** The saved place this visit started from (handed to Match or Recall once). */
  const [resume, setResume] = useState<LearnState | null>(null);
  /** Bumped by Start over, so Match and Recall start fresh. */
  const [run, setRun] = useState(0);
  const saved = useRef<LearnState | null>(null);
  const setKey = useMemo(() => phraseSetKey(phrases), [phrases]);

  // Go on from where you stopped on this set, if the set has not changed since.
  useEffect(() => {
    let alive = true;
    getTalkStore()
      .getLearnState(topic.id, setIndex)
      .catch(() => null)
      .then((st) => {
        if (!alive) return;
        if (isUsableState(st, phrases)) {
          saved.current = st;
          setResume(st);
          setMisses(st.matchMisses);
          setStep(st.step);
        }
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, setIndex]);

  const persist = (patch: Partial<LearnState>) => {
    const next: LearnState = { setKey, step: 'match', matchOrder: [], matchRound: 0, matchMisses: {}, ...saved.current, ...patch, updatedAt: Date.now() };
    saved.current = next;
    void getTalkStore().saveLearnState(topic.id, setIndex, next).catch(() => {});
  };
  const forget = () => {
    saved.current = null;
    void getTalkStore().clearLearnState(topic.id, setIndex).catch(() => {});
  };
  const startOver = () => {
    forget();
    setResume(null);
    setMisses({});
    setRun((n) => n + 1);
    setStep('cards');
  };

  const save = (stage: PhraseStage) => {
    // Progress is a nice-to-have: a failed write must not stop the lesson.
    void getTalkStore()
      .saveStages(topic.id, phrases, stage, progress)
      .then(onProgress)
      .catch((e) => console.warn('[talk] progress save failed', e));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="text-sm text-gray-400 hover:text-gray-100">
          ← {topic.title}
        </button>
        <ol className="flex gap-3 text-xs">
          {STEPS.map((s) => (
            <li key={s.id} className={step === s.id ? 'text-gray-100' : 'text-gray-600'}>
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      {!loaded && <p className="breathe text-sm text-gray-500">Loading…</p>}
      {loaded && resume && step !== 'done' && step !== 'cards' && (
        <p className="text-xs text-gray-500">
          Picked up where you left off: {stateLabel(resume, matchingRounds(phrases).length)}.{' '}
          <button type="button" onClick={startOver} className="underline-offset-2 hover:text-gray-100 hover:underline">
            Start over
          </button>
        </p>
      )}
      {loaded && step === 'cards' && <Cards phrases={phrases} onStart={() => setStep('match')} />}
      {step === 'match' && (
        <TalkMatching
          key={`m${run}`}
          phrases={phrases}
          resume={resume?.step === 'match' ? { order: resume.matchOrder, round: resume.matchRound, misses: resume.matchMisses } : undefined}
          onRound={(p) => persist({ step: 'match', matchOrder: p.order, matchRound: p.round, matchMisses: p.misses, queue: undefined })}
          onDone={(m) => {
            setMisses(m);
            save('recognized');
            persist({ step: 'drill', matchMisses: m });
            setStep('drill');
          }}
        />
      )}
      {step === 'drill' && (
        <TalkDrill
          key={`d${run}`}
          phrases={phrases}
          resume={resume?.step === 'drill' ? resume.queue : undefined}
          onQueue={(q) => persist({ step: 'drill', queue: q })}
          onDone={(m) => {
            setMisses((prev) => addMisses(prev, m));
            save('recalled');
            forget();
            setStep('done');
          }}
        />
      )}
      {step === 'done' && <Done phrases={phrases} misses={misses} onAgain={startOver} onExit={onExit} />}
    </div>
  );
}

function Cards({ phrases, onStart }: { phrases: TalkPhrase[]; onStart: () => void }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {phrases.map((p) => (
          <li key={p.id} className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
            <div className="flex items-baseline gap-2">
              <button type="button" aria-label={`Play ${p.text}`} onClick={() => speak(p.text)} className="self-center text-gray-500 hover:text-gray-100">
                <Volume2 className="h-4 w-4" />
              </button>
              <span className="text-base text-gray-100">{p.text}</span>
              {p.ipa && <span className="font-mono text-xs text-gray-500">{p.ipa}</span>}
            </div>
            <p className="mt-1 text-sm text-gray-400">{p.meaning}</p>
            {p.example && (
              <button type="button" onClick={() => speak(p.example)} className="mt-1 text-left text-sm italic text-gray-500 hover:text-gray-300">
                {p.example}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onStart} className="w-full rounded-lg bg-gray-100 font-medium text-gray-900 hover:bg-white py-2 text-sm">
        Start
      </button>
    </div>
  );
}

function Done({ phrases, misses, onAgain, onExit }: { phrases: TalkPhrase[]; misses: Record<string, number>; onAgain: () => void; onExit: () => void }) {
  const hard = phrases.filter((p) => (misses[p.id] ?? 0) > 0).sort((a, b) => (misses[b.id] ?? 0) - (misses[a.id] ?? 0));
  return (
    <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <p className="text-base text-gray-100">Set learned: {phrases.length} phrases</p>
      {hard.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-gray-500">Hardest</p>
          <ul className="space-y-1">
            {hard.slice(0, 5).map((p) => (
              <li key={p.id} className="text-sm text-gray-300">
                {p.text} <span className="text-xs text-gray-500">{misses[p.id]}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onAgain} className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100">
          Learn again
        </button>
        <button type="button" onClick={onExit} className="rounded-lg bg-gray-100 font-medium text-gray-900 hover:bg-white px-3 py-1.5 text-sm">
          Done
        </button>
      </div>
    </div>
  );
}
