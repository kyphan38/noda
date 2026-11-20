'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TalkAnswerBar, TalkReviewBar } from '@/components/talk/TalkBars';
import { TalkLine } from '@/components/talk/TalkLine';
import { TalkReviewCard, VERSIONS, type VersionKey } from '@/components/talk/TalkReviewCard';
import { TalkSessionEnd } from '@/components/talk/TalkSessionEnd';
import { TalkThread } from '@/components/talk/TalkThread';
import { TalkToggle as Toggle } from '@/components/talk/TalkToggle';
import { useFinePointer } from '@/hooks/useFinePointer';
import { TalkWarmup } from '@/components/talk/TalkWarmup';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { blobToBase64 } from '@/lib/speakingCheck';
import { curveballTurn, hintPhrases, pickScenario, QUICK_TURN_COUNT, replyKindFor, TURN_COUNT, whenLabel, type ReplyKind } from '@/lib/talk/session';
import { speak, stopSpeaking } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import { DEFAULT_PREFS, readLastScenario, readPrefs, writeLastScenario, writePrefs, type TalkPrefs as Prefs } from '@/lib/talk/prefs';
import type { TalkPhraseProgress, TalkScenario, TalkSession as Session, TalkTopic, TalkTurn } from '@/lib/talk/types';

type Line = { text: string; curveball: boolean; ideas: string[]; kind?: ReplyKind };
type Phase = 'answer' | 'checking' | 'review' | 'end';

type Props = {
  topic: TalkTopic;
  setIndex: number;
  progress: Map<string, TalkPhraseProgress>;
  onProgress: (m: Map<string, TalkPhraseProgress>) => void;
  onExit: () => void;
};

/** One talk of 8 answers (3 in quick mode) about one situation, with a review after each answer or at the end. */
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
  /** Which version the review shows; keys 1-3 change it on a computer. */
  const [level, setLevel] = useState<VersionKey>('natural');
  const fine = useFinePointer();
  const recorder = useVoiceRecorder();
  /** Bumped by Cancel, so a check that comes back late is ignored. */
  const attemptRef = useRef(0);
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  /** A fresh talk on a situation not used last time. Saved at once, so leaving keeps it. */
  const startNew = useCallback((speakNow = true, again?: { scenarioId: string; of: string; length?: number }) => {
    const sc = again
      ? (topic.scenarios ?? []).find((x) => x.id === again.scenarioId) ?? null
      : pickScenario(topic.scenarios ?? [], readLastScenario(topic.id));
    setScenario(sc);
    setResumed(false);
    if (!sc) return;
    writeLastScenario(topic.id, sc.id);
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
      // A redo keeps the old talk's length, so the numbers compare.
      length: again?.length ?? (readPrefs().quick ? QUICK_TURN_COUNT : TURN_COUNT),
      ...(again ? { redoOf: again.of } : {}),
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
        setPhase(open.turns.length >= (open.length ?? TURN_COUNT) ? 'end' : 'answer');
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
    writePrefs(next);
  };

  const total = session?.length ?? TURN_COUNT;
  const used = useMemo(() => new Set(session?.turns.flatMap((t) => t.usedPhraseIds) ?? []), [session]);

  const save = (s: Session) => void getTalkStore().saveSession(s).catch((e) => console.warn('[talk] session save failed', e));

  const nextLine = (s: Session, l: Line) => {
    setLevel('natural');
    if (s.turns.length >= (s.length ?? TURN_COUNT)) {
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
        replyKind: replyKindFor(idx + 1, total),
        when: whenLabel(Date.now()),
        isLast: idx === total - 1,
        recording: await blobToBase64(blob),
        recordingMimeType: blob.type || 'audio/webm',
      });
      if (attempt !== attemptRef.current) return;
      const turn: TalkTurn = {
        ai: { text: line.text, curveball: line.curveball, ...(line.kind ? { kind: line.kind } : {}) },
        ideas: line.ideas,
        transcript: result.transcript,
        seconds: result.seconds,
        review: result.review,
        usedPhraseIds: result.usedPhraseIds,
      };
      const reply: Line = { text: result.reply.text, curveball: result.reply.curveball, ideas: result.reply.ideas, kind: replyKindFor(idx + 1, total) };
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
      stopSpeaking();
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
    const l: Line = { text: last.ai.text, curveball: last.ai.curveball, ideas: last.ideas ?? [], kind: last.ai.kind };
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
      const el = e.target as HTMLElement | null;
      if (e.repeat || (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'))) return;
      if (phase === 'review') {
        // Computer keys for the review: Enter next, R try again, 1-3 versions.
        if (e.code === 'Enter' && el?.tagName !== 'BUTTON') {
          e.preventDefault();
          if (session && line) nextLine(session, line);
        } else if (e.key === 'r' || e.key === 'R') retryTurn();
        else if (['1', '2', '3'].includes(e.key)) setLevel(VERSIONS[Number(e.key) - 1].key);
        return;
      }
      if (e.code !== 'Space' || el?.tagName === 'BUTTON') return;
      e.preventDefault();
      toggleRecord();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // nextLine and retryTurn only read state passed in or current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleRecord, cancelAnswer, recorder.status, phase, session, line]);

  if (loading) return <p className="breathe text-sm text-gray-500">Loading…</p>;
  if (!scenario) return <p className="text-sm text-gray-400">This topic has no situations. Make it again.</p>;
  if (!session || !line) return null;
  if (phase === 'end')
    return (
      <TalkSessionEnd
        session={session}
        phrases={phrases}
        onChange={setSession}
        onExit={onExit}
        onRedo={() => {
          setWarmDone(true);
          startNew(true, { scenarioId: session.scenarioId, of: session.id, length: session.length });
        }}
      />
    );

  const turnNo = Math.min(session.turns.length + (phase === 'review' ? 0 : 1), total);
  const lastTurn = session.turns[session.turns.length - 1];
  const reviewing = phase === 'review' && !!lastTurn;
  const hints = hintPhrases(line.text, phrases, used);
  const warming = !warmDone && !resumed && session.turns.length === 0;
  const pairs = (reviewing ? session.turns.slice(0, -1) : session.turns).map((t) => ({ ai: t.ai.text, you: t.transcript }));
  const patchLast = (patch: Partial<TalkTurn>) => {
    const s = { ...session, turns: session.turns.map((t, i) => (i === session.turns.length - 1 ? { ...t, ...patch } : t)) };
    setSession(s);
    save(s);
  };

  return (
    // At least a screen tall, so the bar sits at the bottom (thumb reach) even when the talk is short.
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-5 sm:min-h-[calc(100dvh-13rem)]">
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
        <button type="button" onClick={onExit} className="truncate text-sm text-gray-400 hover:text-gray-100">
          ← {topic.title}
        </button>
        <span className="flex shrink-0 items-center gap-3">
          <span className="tabular-nums">
            {turnNo}/{total}
          </span>
          {session.turns.length > 0 && phase !== 'checking' && (
            <button
              type="button"
              onClick={() => {
                save({ ...session, endedAt: Date.now() });
                setWarmDone(true);
                startNew();
              }}
              className="hover:text-gray-100"
            >
              New
            </button>
          )}
          <button type="button" onClick={endTalk} className="hover:text-gray-100">
            End
          </button>
        </span>
      </div>

      {resumed && <p className="text-xs text-gray-500">Picked up where you left off.</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <Fold label={scenario.title} open={session.turns.length === 0}>
          <ul className="list-disc space-y-0.5 pl-5">
            {scenario.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Fold>
        {topic.notes && (
          <Fold label={topic.notesKind === 'stuck' ? 'What you wanted to say' : 'Your notes'} open={session.turns.length === 0}>
            <p className="whitespace-pre-wrap">{topic.notes}</p>
          </Fold>
        )}
      </div>

      {warming && (
        <TalkWarmup
          onDone={() => {
            setWarmDone(true);
            speak(line.text);
          }}
        />
      )}

      {session.turns.length === 0 && phase === 'answer' && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Toggle on={prefs.mode === 'flow'} onClick={() => changePrefs({ mode: prefs.mode === 'flow' ? 'instant' : 'flow' })}>
            {prefs.mode === 'flow' ? 'Flow: review at the end' : 'Review after each answer'}
          </Toggle>
          <Toggle on={prefs.selfRepair} onClick={() => changePrefs({ selfRepair: !prefs.selfRepair })}>
            Fix it yourself first
          </Toggle>
          <Toggle
            on={prefs.quick}
            onClick={() => {
              const quick = !prefs.quick;
              changePrefs({ quick });
              setSession({ ...session, length: quick ? QUICK_TURN_COUNT : TURN_COUNT });
            }}
          >
            Quick: {QUICK_TURN_COUNT} answers
          </Toggle>
        </div>
      )}

      {!warming && (
        <div className="space-y-6 md:grid md:grid-cols-2 md:gap-10 md:space-y-0">
          <div className="space-y-4">
            <TalkThread name={topic.persona.name} pairs={pairs} />
            <TalkLine
              topicId={topic.id}
              name={topic.persona.name}
              text={reviewing ? lastTurn.ai.text : line.text}
              curveball={reviewing ? lastTurn.ai.curveball : line.curveball}
              kind={reviewing ? undefined : line.kind}
              ideas={line.ideas}
              hints={hints}
              showText={prefs.showText}
              onToggleText={() => changePrefs({ showText: !prefs.showText })}
              quiet={reviewing}
            />
          </div>
          <div className="md:border-l md:border-gray-800 md:pl-10">
            {reviewing ? (
              <TalkReviewCard key={session.turns.length} turn={lastTurn} selfRepair={prefs.selfRepair} onChange={patchLast} level={level} onLevel={setLevel} showKeys={fine} />
            ) : (
              <p className="hidden text-xs text-gray-600 md:block">Your review shows here after you answer.</p>
            )}
          </div>
        </div>
      )}

      <Fold label={`Phrases ${used.size}/${phrases.length}`}>
        <div className="flex flex-wrap gap-1.5">
          {phrases.map((p) => (
            <span key={p.id} className={`rounded-md border px-2 py-0.5 ${used.has(p.id) ? 'border-gray-500 text-gray-100' : 'border-gray-800 text-gray-500'}`}>
              {used.has(p.id) ? '✓ ' : ''}
              {p.text}
            </span>
          ))}
        </div>
      </Fold>

      {!warming &&
        (reviewing ? (
          <TalkReviewBar
            key={session.turns.length}
            target={lastTurn.review.natural}
            nextLabel={session.turns.length >= total ? 'See the summary' : 'Next'}
            fine={fine}
            onTry={retryTurn}
            onNext={() => nextLine(session, line)}
            onScore={(retryPercent) => patchLast({ retryPercent })}
          />
        ) : (
          <TalkAnswerBar
            recording={recorder.status === 'recording'}
            busy={phase === 'checking' || recorder.status === 'starting'}
            checking={phase === 'checking'}
            seconds={Math.round(recorder.elapsedMs / 1000)}
            error={error ?? recorder.error}
            fine={fine}
            onToggle={toggleRecord}
            onCancel={cancelAnswer}
          />
        ))}
    </div>
  );
}

/** A small "label ▸" line that opens to its content; no box. */
function Fold({ label, open = false, children }: { label: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group w-full text-xs text-gray-500 [&_summary::-webkit-details-marker]:hidden" open={open}>
      <summary className="cursor-pointer list-none hover:text-gray-300">
        {label} <span className="inline-block transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="mt-1.5 text-sm text-gray-400">{children}</div>
    </details>
  );
}
