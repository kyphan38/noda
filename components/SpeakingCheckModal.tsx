'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Mic, Minus, Play, Square, X } from 'lucide-react';

import { ModalShell } from '@/components/ModalShell';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { listSpeakingAttemptsFirestore } from '@/lib/db';
import type { ShadowingMediaSource } from '@/lib/shadowingAnalysis';
import { requestSpeakingCheck } from '@/lib/speakingCheck';
import { buildSpeakingSegments, type SpeakingSegment } from '@/lib/speakingSegments';
import { cn } from '@/lib/utils';
import type { Sentence, SpeakingAttempt, SpeakingBand } from '@/types';

const BAND_LABEL: Record<SpeakingBand, string> = {
  great: 'Great',
  good: 'Good',
  practice: 'Keep practicing',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const formatClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  return msg && msg.length < 120 ? msg : 'The check failed, try again.';
}

export interface SpeakingCheckModalProps {
  lessonId: string;
  transcript: Sentence[];
  media: ShadowingMediaSource;
  onClose: () => void;
}

/**
 * Speaking check: the lesson split into 30-50 word segments; record each one and
 * get a score, the words that went wrong, which sound habits came through, and the
 * top fixes. Opened from the player in Shadowing mode.
 */
export function SpeakingCheckModal({ lessonId, transcript, media, onClose }: SpeakingCheckModalProps) {
  const segments = useMemo(() => buildSpeakingSegments(transcript), [transcript]);
  const [attempts, setAttempts] = useState<SpeakingAttempt[]>([]);
  const [selected, setSelected] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [take, setTake] = useState<{ segmentId: string; url: string } | null>(null);
  const recorder = useVoiceRecorder();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    listSpeakingAttemptsFirestore(lessonId)
      .then((list) => live && setAttempts(list))
      .catch(() => {
        // History is a nice-to-have; the check itself still works without it.
      });
    return () => {
      live = false;
    };
  }, [lessonId]);

  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url);
  }, [take]);

  const bySegment = useMemo(() => {
    const map = new Map<string, SpeakingAttempt[]>();
    for (const a of attempts) {
      const list = map.get(a.segmentId) ?? [];
      list.push(a);
      map.set(a.segmentId, list);
    }
    return map;
  }, [attempts]);

  const summary = useMemo(() => {
    const latest = segments
      .map((s) => bySegment.get(s.id)?.at(-1))
      .filter((a): a is SpeakingAttempt => !!a);
    const avg = latest.length ? Math.round(latest.reduce((n, a) => n + a.score, 0) / latest.length) : null;
    return { done: latest.length, avg };
  }, [segments, bySegment]);

  const segment = segments[selected] as SpeakingSegment | undefined;
  const segmentAttempts = segment ? bySegment.get(segment.id) ?? [] : [];
  const shown = segmentAttempts.at(-1);
  const busy = checking || recorder.status !== 'idle';

  const select = useCallback(
    (i: number) => {
      if (busy) return;
      setSelected(i);
      setCheckError(null);
    },
    [busy]
  );

  // Keep the open segment in view when moving with Next.
  useEffect(() => {
    listRef.current?.querySelector(`[data-segment-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onRecord = useCallback(async () => {
    if (!segment) return;
    if (recorder.status === 'recording') {
      const blob = await recorder.stop();
      if (!blob) return;
      setTake((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { segmentId: segment.id, url: URL.createObjectURL(blob) };
      });
      setChecking(true);
      setCheckError(null);
      try {
        const attempt = await requestSpeakingCheck(lessonId, segment, media, blob);
        setAttempts((prev) => [...prev, attempt]);
      } catch (e) {
        setCheckError(errorMessage(e));
      } finally {
        setChecking(false);
      }
      return;
    }
    setCheckError(null);
    await recorder.start();
  }, [segment, recorder, lessonId, media]);

  const close = useCallback(() => {
    recorder.cancel();
    onClose();
  }, [recorder, onClose]);

  return (
    <ModalShell
      onClose={close}
      labelledBy="noda-speaking-title"
      backdropClassName="bg-black/80 z-[200] p-3 sm:p-4 backdrop-blur-sm"
      panelClassName="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden"
      closeOnBackdrop={!busy}
      portal
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 id="noda-speaking-title" className="text-lg font-semibold text-white">
            Speaking check
          </h3>
          <p className="text-xs text-gray-400" data-speaking-summary>
            {summary.done}/{segments.length} parts
            {summary.avg !== null && ` · Average ${summary.avg}`}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {segments.length === 0 && <p className="px-1 text-sm text-gray-400">No text to read.</p>}
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {segments.map((s, i) => {
            const last = bySegment.get(s.id)?.at(-1);
            const open = i === selected;
            return (
              <li
                key={s.id}
                data-segment-index={i}
                className={cn('rounded-lg border', open ? 'border-gray-600 bg-gray-800/40' : 'border-gray-800')}
              >
                <button
                  type="button"
                  onClick={() => select(i)}
                  disabled={busy && !open}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-50"
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-gray-500">{i + 1}</span>
                  <span className={cn('min-w-0 flex-1 text-sm text-gray-300', !open && 'truncate')}>
                    {open ? '' : s.text}
                  </span>
                  {last && (
                    <span className="shrink-0 rounded-md bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-gray-200">
                      {last.score}
                    </span>
                  )}
                </button>
                {open && (
                  <SegmentBody
                    segment={s}
                    attempt={shown}
                    tries={segmentAttempts}
                    recorderStatus={recorder.status}
                    elapsedMs={recorder.elapsedMs}
                    checking={checking}
                    error={checkError ?? recorder.error}
                    takeUrl={take?.segmentId === s.id ? take.url : null}
                    onRecord={() => void onRecord()}
                    onNext={i < segments.length - 1 ? () => select(i + 1) : undefined}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </ModalShell>
  );
}

function SegmentBody({
  segment,
  attempt,
  tries,
  recorderStatus,
  elapsedMs,
  checking,
  error,
  takeUrl,
  onRecord,
  onNext,
}: {
  segment: SpeakingSegment;
  attempt: SpeakingAttempt | undefined;
  tries: SpeakingAttempt[];
  recorderStatus: 'idle' | 'starting' | 'recording';
  elapsedMs: number;
  checking: boolean;
  error: string | null;
  takeUrl: string | null;
  onRecord: () => void;
  onNext?: () => void;
}) {
  const recording = recorderStatus === 'recording';
  // A result belongs to the text it was made for; after a transcript edit it no longer lines up.
  const result = attempt && attempt.referenceText === segment.text ? attempt : undefined;
  const best = tries.length ? Math.max(...tries.map((t) => t.score)) : null;

  return (
    <div className="grid gap-3 px-3 pb-3">
      <HighlightedText text={segment.text} attempt={result} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={recording ? 'default' : 'secondary'}
          onClick={onRecord}
          disabled={checking || recorderStatus === 'starting'}
          data-speaking-record
        >
          {recording ? <Square className="fill-current" /> : <Mic />}
          {recording ? `Stop ${formatClock(elapsedMs)}` : result ? 'Try again' : 'Record'}
        </Button>
        {recording && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-label="Recording" />}
        {checking && <span className="text-sm text-gray-400" role="status">Checking…</span>}
        {takeUrl && !recording && !checking && <PlayTake url={takeUrl} />}
        {onNext && result && !recording && !checking && (
          <Button type="button" variant="ghost" onClick={onNext} className="ml-auto">
            Next <ChevronRight />
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-gray-300" role="alert">
          {error}
        </p>
      )}

      {result && !checking && <Result attempt={result} tries={tries.length} best={best} />}
    </div>
  );
}

function PlayTake({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (el.paused) {
            el.currentTime = 0;
            void el.play();
          } else el.pause();
        }}
      >
        {playing ? <Square className="fill-current" /> : <Play />}
        My take
      </Button>
    </>
  );
}

function HighlightedText({ text, attempt }: { text: string; attempt?: SpeakingAttempt }) {
  const issues = useMemo(() => new Map((attempt?.wordIssues ?? []).map((i) => [i.index, i])), [attempt]);
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <p className="text-[15px] leading-relaxed text-gray-100">
      {words.map((w, i) => {
        const issue = issues.get(i);
        return (
          <React.Fragment key={i}>
            {i > 0 && ' '}
            {issue ? (
              <span
                data-word-issue={issue.kind}
                title={issue.kind === 'missing' ? 'Missing' : `Heard "${issue.heard}"`}
                className={cn(
                  issue.kind === 'missing'
                    ? 'text-gray-500 line-through'
                    : 'underline decoration-gray-300 decoration-wavy underline-offset-4'
                )}
              >
                {w}
              </span>
            ) : (
              w
            )}
          </React.Fragment>
        );
      })}
    </p>
  );
}

function Result({ attempt, tries, best }: { attempt: SpeakingAttempt; tries: number; best: number | null }) {
  const words = attempt.referenceText.split(/\s+/).filter(Boolean);
  const parts: Array<[string, number | null]> = [
    ['Words', attempt.parts.words],
    ['Sounds', attempt.parts.sounds],
    ['Stress & tone', attempt.parts.delivery],
    ['Pace', attempt.parts.pace],
  ];
  return (
    <div className="grid gap-3 border-t border-gray-800 pt-3" data-speaking-result>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div>
          <span className="text-3xl font-semibold tabular-nums text-white">{attempt.score}</span>
          <span className="ml-2 text-sm text-gray-300">{BAND_LABEL[attempt.band]}</span>
        </div>
        {tries > 1 && best !== null && (
          <span className="pb-1 text-xs text-gray-500">
            Best {best} · {tries} tries
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {parts
          .filter(([, v]) => v !== null)
          .map(([label, v]) => (
            <div key={label} className="rounded-md bg-gray-800/60 px-2 py-1.5">
              <dt className="text-[11px] text-gray-400">{label}</dt>
              <dd className="font-mono text-sm text-gray-100">{pct(v as number)}</dd>
            </div>
          ))}
      </dl>

      {attempt.wordIssues.length > 0 && (
        <Section title="Words">
          {attempt.wordIssues.map((i) => (
            <li key={i.index} className="text-sm text-gray-300">
              <span className="font-medium text-gray-100">{words[i.index] ?? ''}</span>
              {i.kind === 'missing' ? ' - missing' : ` → "${i.heard}"`}
              {i.tip && <span className="text-gray-400">: {i.tip}</span>}
            </li>
          ))}
        </Section>
      )}

      {attempt.checks.length > 0 && (
        <Section title="Sounds">
          {attempt.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="mt-0.5 shrink-0 text-gray-400" aria-label={c.result}>
                {c.result === 'yes' ? (
                  <Check className="h-3.5 w-3.5 text-gray-100" />
                ) : c.result === 'partly' ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </span>
              <span>
                <span className="text-gray-100">{c.text}</span>
                {c.sounds && <span className="text-gray-400"> → {c.sounds}</span>}
              </span>
            </li>
          ))}
        </Section>
      )}

      {attempt.fixes.length > 0 && (
        <Section title="Fix next">
          {attempt.fixes.map((f, i) => (
            <li key={i} className="text-sm text-gray-300">
              {f.text && <span className="font-medium text-gray-100">{f.text}: </span>}
              {f.why}
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</h4>
      <ul className="grid gap-1">{children}</ul>
    </div>
  );
}
