'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Volume2, Zap } from 'lucide-react';

import { TalkReviewCard } from '@/components/talk/TalkReviewCard';
import { TalkSessionEnd } from '@/components/talk/TalkSessionEnd';
import { TalkWarmup } from '@/components/talk/TalkWarmup';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { blobToBase64 } from '@/lib/speakingCheck';
import { curveballTurn, hintPhrases, pickScenario, TURN_COUNT } from '@/lib/talk/session';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkMode, TalkPhraseProgress, TalkScenario, TalkSession as Session, TalkTopic, TalkTurn } from '@/lib/talk/types';

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
  const [scenario, setScenario] = useState<TalkScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumed, setResumed] = useState(false);
  /** The warm-up runs once, before the first talk on this screen. */
  const [warmDone, setWarmDone] = useState(false);
  const [curveAt] = useState(() => curveballTurn(topic.level));
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [session, setSession] = useState<Session | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [phase, setPhase] = useState<Phase>('answer');
  const [error, setError] = useState<string | null>(null);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const recorder = useVoiceRecorder();
  /** Bumped by Cancel, so a check that comes back late is ignored. */
  const attemptRef = useRef(0);
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  /** A fresh talk on a situation not used last time. Saved at once, so leaving keeps it. */
  const startNew = useCallback((speakNow = true) => {
    const sc = pickScenario(topic.scenarios ?? [], readLastScenario(topic.id));
    setScenario(sc);
    setResumed(false);
    if (!sc) return;
    try {
      localStorage.setItem(lastScenarioKey(topic.id), sc.id);
    } catch {
      // Private mode: the next talk may repeat this situation.
    }
    const first = { text: sc.opening, curveball: false, ideas: sc.ideas };
    const s: Session = {
      id: `${topic.id}-${Date.now().toString(36)}`,
      topicId: topic.id,
      setIndex,
      scenarioId: sc.id,
      level: topic.level,
      mode: 'instant',
      selfRepair: true,
      turns: [],
      next: first,
      startedAt: Date.now(),
    };
    setLine(first);
    setSession(s);
    setPhase('answer');
    void getTalkStore().saveSession(s).catch(() => {});
    if (speakNow) speak(first.text);
  }, [topic.id, topic.level, topic.scenarios, setIndex]);

  // Go on with a talk left halfway on this set; otherwise start one.
  useEffect(() => {
    let alive = true;
    setPrefs(readPrefs());
    getTalkStore()
      .findOpenSession(topic.id, setIndex)
      .catch(() => null)
      .then((open) => {
        if (!alive) return;
        setLoading(false);
        const sc = open && (topic.scenarios ?? []).find((x) => x.id === open.scenarioId);
        if (!open || !sc) return startNew(false);
        setScenario(sc);
        setSession(open);
        setResumed(open.turns.length > 0);
        setLine(open.next ?? { text: sc.opening, curveball: false, ideas: sc.ideas });
        setPhase(open.turns.length >= TURN_COUNT ? 'end' : 'answer');
      });
    return () => {
      alive = false;
    };
    // Only once per topic and set; startNew reads the same values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, setIndex]);

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
    const attempt = ++attemptRef.current;
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
      if (attempt !== attemptRef.current) return;
      const turn: TalkTurn = {
        ai: { text: line.text, curveball: line.curveball },
        ideas: line.ideas,
        transcript: result.transcript,
        seconds: result.seconds,
        review: result.review,
        usedPhraseIds: result.usedPhraseIds,
      };
      const reply = { text: result.reply.text, curveball: result.reply.curveball, ideas: result.reply.ideas };
      const s = { ...session, mode: prefs.mode, selfRepair: prefs.selfRepair, turns: [...session.turns, turn], next: reply };
      setSession(s);
      save(s);
      const newlyUsed = phrases.filter((p) => result.usedPhraseIds.includes(p.id));
      if (newlyUsed.length > 0) {
        void getTalkStore()
          .saveStages(topic.id, newlyUsed, 'prompted', progressRef.current)
          .then(onProgress)
          .catch(() => {});
      }
      setLine(reply);
      if (prefs.mode === 'instant') setPhase('review');
      else nextLine(s, reply);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
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

  /** Drop the take being recorded or checked, and answer the same line again. */
  const cancelAnswer = useCallback(() => {
    attemptRef.current++;
    if (recorder.status !== 'idle') recorder.cancel();
    setError(null);
    setPhase('answer');
  }, [recorder]);

  /** Throw away the last answer and its review, and answer that line again. */
  const retryTurn = () => {
    if (!session) return;
    const last = session.turns[session.turns.length - 1];
    if (!last) return;
    const l = { text: last.ai.text, curveball: last.ai.curveball, ideas: last.ideas ?? [] };
    const s = { ...session, turns: session.turns.slice(0, -1), next: l };
    setSession(s);
    save(s);
    setLine(l);
    setPhase('answer');
    speak(l.text);
  };

  /** Stop early: the summary of what was said so far, or back to the topic when nothing was. */
  const endTalk = () => {
    if (!session) return;
    cancelAnswer();
    if (session.turns.length === 0) return onExit();
    const done = { ...session, endedAt: Date.now() };
    setSession(done);
    save(done);
    setPhase('end');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && (recorder.status === 'recording' || phase === 'checking')) {
        cancelAnswer();
        return;
      }
      if (e.code !== 'Space' || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) return;
      e.preventDefault();
      toggleRecord();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRecord, cancelAnswer, recorder.status, phase]);

  if (loading) return <p className="breathe text-sm text-gray-500">Loading…</p>;
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
        <span className="flex items-center gap-3 text-xs text-gray-500">
          <span className="tabular-nums">
            Turn {turnNo}/{TURN_COUNT}
          </span>
          {session.turns.length > 0 && phase !== 'checking' && (
            <button
              type="button"
              onClick={() => {
                const done = { ...session, endedAt: Date.now() };
                save(done);
                setWarmDone(true);
                startNew();
              }}
              className="hover:text-gray-100"
            >
              New talk
            </button>
          )}
          <button type="button" onClick={endTalk} className="hover:text-gray-100">
            End talk
          </button>
        </span>
      </div>

      {topic.notes && (
        <details className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3" open>
          <summary className="cursor-pointer text-sm text-gray-100">{topic.notesKind === 'stuck' ? 'What you wanted to say' : 'Your notes'}</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-400">{topic.notes}</p>
        </details>
      )}

      {resumed && <p className="text-xs text-gray-500">Picked up where you left off.</p>}

      {!warmDone && !resumed && session.turns.length === 0 && (
        <TalkWarmup
          onDone={() => {
            setWarmDone(true);
            speak(line.text);
          }}
        />
      )}

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

      {!warmDone && !resumed && session.turns.length === 0 ? null : phase === 'review' && lastTurn ? (
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
          <div className="flex gap-2">
            <button type="button" onClick={retryTurn} className="rounded-lg border border-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-100/[0.06]">
              Try again
            </button>
            <button type="button" onClick={() => nextLine(session, line)} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white">
              {session.turns.length >= TURN_COUNT ? 'See the summary' : 'Next turn'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs text-gray-300">
                {topic.persona.name.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-gray-500">
                  {topic.persona.name}, {topic.persona.role}
                  {line.curveball && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-gray-300">
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
                      <span key={p.id} className="rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-200">
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
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                recorder.status === 'recording' ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-gray-100 text-gray-900 hover:bg-white'
              }`}
            >
              {recorder.status === 'recording' ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
            </button>
            <p className="text-xs text-gray-500">
              {phase === 'checking' ? <span className="breathe">Checking your answer…</span> : recorder.status === 'recording' ? `${Math.round(recorder.elapsedMs / 1000)}s · Space to send` : 'Space to answer'}
            </p>
            {(recorder.status === 'recording' || phase === 'checking') && (
              <button type="button" onClick={cancelAnswer} className="text-xs text-gray-400 underline-offset-2 hover:text-gray-100 hover:underline">
                Cancel (Esc)
              </button>
            )}
            {(error || recorder.error) && <p className="text-xs text-red-400">{error ?? recorder.error}</p>}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-1.5">
        {phrases.map((p) => (
          <span key={p.id} className={`rounded-md border px-2 py-0.5 text-xs ${used.has(p.id) ? 'border-gray-500 text-gray-100' : 'border-gray-800 text-gray-500'}`}>
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
      className={`rounded-lg border px-2.5 py-1 ${on ? 'border-gray-500 bg-gray-800 text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'}`}
    >
      {children}
    </button>
  );
}
