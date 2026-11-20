'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Volume2, Zap } from 'lucide-react';

import { TalkReviewCard } from '@/components/talk/TalkReviewCard';
import { TalkSessionEnd } from '@/components/talk/TalkSessionEnd';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { blobToBase64 } from '@/lib/speakingCheck';
import { curveballTurn, hintPhrases, pickScenario, TURN_COUNT } from '@/lib/talk/session';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkMode, TalkPhraseProgress, TalkSession as Session, TalkTopic, TalkTurn } from '@/lib/talk/types';

const PREFS_KEY = 'noda.talk.prefs';
type Prefs = { mode: TalkMode; selfRepair: boolean; showText: boolean };
const DEFAULT_PREFS: Prefs = { mode: 'instant', selfRepair: true, showText: true };

function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}
const lastScenarioKey = (topicId: string) => `noda.talk.lastScenario.${topicId}`;
function readLastScenario(topicId: string): string | undefined {
  try {
    return localStorage.getItem(lastScenarioKey(topicId)) ?? undefined;
  } catch {
    return undefined;
  }
}

type Line = { text: string; curveball: boolean; ideas: string[] };
type Phase = 'answer' | 'checking' | 'review' | 'end';

type Props = {
  topic: TalkTopic;
  setIndex: number;
  progress: Map<string, TalkPhraseProgress>;
  onProgress: (m: Map<string, TalkPhraseProgress>) => void;
  onExit: () => void;
};

/** One talk of TURN_COUNT answers about one situation, with a review after each answer or at the end. */
export function TalkSession({ topic, setIndex, progress, onProgress, onExit }: Props) {
  const phrases = useMemo(() => topic.phrases.filter((p) => p.setIndex === setIndex && !p.removed), [topic.phrases, setIndex]);
  const [scenario] = useState(() => pickScenario(topic.scenarios ?? [], readLastScenario(topic.id)));
  const [curveAt] = useState(() => curveballTurn(topic.level));
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [session, setSession] = useState<Session | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [phase, setPhase] = useState<Phase>('answer');
  const [error, setError] = useState<string | null>(null);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const recorder = useVoiceRecorder();
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!scenario) return;
    setPrefs(readPrefs());
    try {
      localStorage.setItem(lastScenarioKey(topic.id), scenario.id);
    } catch {
      // Private mode: the next talk may repeat this situation.
    }
    const first = { text: scenario.opening, curveball: false, ideas: scenario.ideas };
    setLine(first);
    setSession({
      id: `${topic.id}-${Date.now().toString(36)}`,
      topicId: topic.id,
      setIndex,
      scenarioId: scenario.id,
      level: topic.level,
      mode: 'instant',
      selfRepair: true,
      turns: [],
      startedAt: Date.now(),
    });
    speak(first.text);
  }, [scenario, topic.id, topic.level, setIndex]);

  const changePrefs = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Kept for this visit only.
    }
  };

  const used = useMemo(() => new Set(session?.turns.flatMap((t) => t.usedPhraseIds) ?? []), [session]);

  const save = (s: Session) => void getTalkStore().saveSession(s).catch((e) => console.warn('[talk] session save failed', e));

  const nextLine = (s: Session, l: Line) => {
    setShowIdeas(false);
    setShowHints(false);
    if (s.turns.length >= TURN_COUNT) {
      const done = { ...s, endedAt: Date.now() };
      setSession(done);
      save(done);
      setPhase('end');
      return;
    }
    setLine(l);
    setPhase('answer');
    speak(l.text);
  };

  const submit = useCallback(async () => {
    if (!session || !line) return;
    const blob = await recorder.stop();
    if (!blob) return;
    setPhase('checking');
    setError(null);
    const idx = session.turns.length;
    try {
      const result = await getTalkStore().runTurn({
        topicId: topic.id,
        scenarioId: session.scenarioId,
        aiLine: line.text,
        history: session.turns.slice(-3).map((t) => ({ ai: t.ai.text, you: t.transcript })),
        targetIds: phrases.filter((p) => !used.has(p.id)).map((p) => p.id),
        curveball: curveAt !== null && idx + 1 === curveAt,
        isLast: idx === TURN_COUNT - 1,
        recording: await blobToBase64(blob),
        recordingMimeType: blob.type || 'audio/webm',
      });
      const turn: TalkTurn = {
        ai: { text: line.text, curveball: line.curveball },
        ideas: line.ideas,
        transcript: result.transcript,
        seconds: result.seconds,
        review: result.review,
        usedPhraseIds: result.usedPhraseIds,
      };
      const s = { ...session, mode: prefs.mode, selfRepair: prefs.selfRepair, turns: [...session.turns, turn] };
      setSession(s);
      save(s);
      const newlyUsed = phrases.filter((p) => result.usedPhraseIds.includes(p.id));
      if (newlyUsed.length > 0) {
        void getTalkStore()
          .saveStages(topic.id, newlyUsed, 'prompted', progressRef.current)
          .then(onProgress)
          .catch(() => {});
      }
      const reply = { text: result.reply.text, curveball: result.reply.curveball, ideas: result.reply.ideas };
      setLine(reply);
      if (prefs.mode === 'instant') setPhase('review');
      else nextLine(s, reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check this answer, try again.');
      setPhase('answer');
    }
    // nextLine and save only read their arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, line, recorder, topic.id, phrases, used, curveAt, prefs, onProgress]);

  const toggleRecord = useCallback(() => {
    if (phase !== 'answer') return;
    if (recorder.status === 'recording') void submit();
    else if (recorder.status === 'idle') {
      window.speechSynthesis?.cancel();
      void recorder.start();
    }
  }, [phase, recorder, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) return;
      e.preventDefault();
      toggleRecord();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRecord]);

  if (!scenario) return <p className="text-sm text-gray-400">This topic has no situations. Make it again.</p>;
  if (!session || !line) return null;
  if (phase === 'end') return <TalkSessionEnd session={session} phrases={phrases} onChange={setSession} onExit={onExit} />;

  const turnNo = Math.min(session.turns.length + (phase === 'review' ? 0 : 1), TURN_COUNT);
  const lastTurn = session.turns[session.turns.length - 1];
  const hints = hintPhrases(line.text, phrases, used);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="text-sm text-gray-400 hover:text-gray-100">
          ← {topic.title}
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          Turn {turnNo}/{TURN_COUNT}
        </span>
      </div>

      <details className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3" open={session.turns.length === 0}>
        <summary className="cursor-pointer text-sm text-gray-100">{scenario.title}</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-gray-400">
          {scenario.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </details>

      {session.turns.length === 0 && phase === 'answer' && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Toggle on={prefs.mode === 'flow'} onClick={() => changePrefs({ mode: prefs.mode === 'flow' ? 'instant' : 'flow' })}>
            {prefs.mode === 'flow' ? 'Flow: review at the end' : 'Review after each answer'}
          </Toggle>
          <Toggle on={prefs.selfRepair} onClick={() => changePrefs({ selfRepair: !prefs.selfRepair })}>
            Fix it yourself first
          </Toggle>
        </div>
      )}

      {phase === 'review' && lastTurn ? (
        <>
          <TalkReviewCard
            key={session.turns.length}
            turn={lastTurn}
            selfRepair={prefs.selfRepair}
            onChange={(patch) => {
              const turns = session.turns.map((t, i) => (i === session.turns.length - 1 ? { ...t, ...patch } : t));
              const s = { ...session, turns };
              setSession(s);
              save(s);
            }}
          />
          <button type="button" onClick={() => nextLine(session, line)} className="w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-500">
            {session.turns.length >= TURN_COUNT ? 'See the summary' : 'Next turn'}
          </button>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs text-blue-300">
                {topic.persona.name.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-gray-500">
                  {topic.persona.name}, {topic.persona.role}
                  {line.curveball && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-yellow-400">
                      <Zap className="h-3 w-3" /> curveball
                    </span>
                  )}
                </p>
                {prefs.showText ? <p className="text-base text-gray-100">{line.text}</p> : <p className="text-sm italic text-gray-500">Listen, then answer.</p>}
                <div className="flex flex-wrap gap-3 text-xs">
                  <button type="button" onClick={() => speak(line.text)} className="flex items-center gap-1 text-gray-400 hover:text-gray-100">
                    <Volume2 className="h-3.5 w-3.5" /> Play
                  </button>
                  <button type="button" onClick={() => changePrefs({ showText: !prefs.showText })} className="text-gray-400 hover:text-gray-100">
                    {prefs.showText ? 'Hide text' : 'Show text'}
                  </button>
                  {line.ideas.length > 0 && (
                    <button type="button" onClick={() => setShowIdeas((v) => !v)} className="text-gray-400 hover:text-gray-100">
                      Ideas
                    </button>
                  )}
                  {hints.length > 0 && (
                    <button type="button" onClick={() => setShowHints((v) => !v)} className="text-gray-400 hover:text-gray-100">
                      Phrases
                    </button>
                  )}
                </div>
                {showIdeas && (
                  <ul className="list-disc pl-5 text-sm text-gray-300">
                    {line.ideas.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
                {showHints && (
                  <div className="flex flex-wrap gap-1.5">
                    {hints.map((p) => (
                      <span key={p.id} className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-200">
                        {p.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 py-2">
            <button
              type="button"
              aria-label={recorder.status === 'recording' ? 'Stop and send' : 'Answer'}
              disabled={phase === 'checking' || recorder.status === 'starting'}
              onClick={toggleRecord}
              className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition-colors disabled:opacity-50 ${
                recorder.status === 'recording' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {recorder.status === 'recording' ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
            </button>
            <p className="text-xs text-gray-500">
              {phase === 'checking' ? <span className="breathe">Checking your answer…</span> : recorder.status === 'recording' ? `${Math.round(recorder.elapsedMs / 1000)}s · Space to send` : 'Space to answer'}
            </p>
            {(error || recorder.error) && <p className="text-xs text-red-400">{error ?? recorder.error}</p>}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-1.5">
        {phrases.map((p) => (
          <span key={p.id} className={`rounded-md border px-2 py-0.5 text-xs ${used.has(p.id) ? 'border-green-700/60 text-green-300' : 'border-gray-800 text-gray-500'}`}>
            {used.has(p.id) ? '✓ ' : ''}
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 ${on ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-gray-800 text-gray-400 hover:text-gray-100'}`}
    >
      {children}
    </button>
  );
}
