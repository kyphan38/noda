'use client';

import { useEffect, useState } from 'react';

import { canPlayLines, MissPractice, type LessonMedia } from '@/components/MissPractice';
import { TalkWarmup } from '@/components/talk/TalkWarmup';
import { pickDailyLines, dayKey } from '@/lib/daily-queue';
import { clearMissFirestore, listLessonsFirestore, listMissesFirestore } from '@/lib/db';
import { topMisses, type MissRow } from '@/lib/dictation-misses';
import { pickWarmup } from '@/lib/talk/mistake-bank';
import { getTalkStore } from '@/lib/talk/store';

const DONE_KEY = 'noda.daily.done';

type Step = 'start' | 'lines' | 'talk' | 'done';
type Plan = { lines: MissRow[]; media: Map<string, LessonMedia>; fixes: number };

function doneToday(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === dayKey(Date.now());
  } catch {
    return false;
  }
}

function markDone() {
  try {
    localStorage.setItem(DONE_KEY, dayKey(Date.now()));
  } catch {
    // Kept for this visit only.
  }
}

async function loadPlan(): Promise<Plan> {
  const [lines, fixes] = await Promise.all([
    Promise.all([listMissesFirestore(), listLessonsFirestore()])
      .then(([docs, lessons]) => {
        const live = lessons.filter((l) => !l.isTrashed);
        const media = new Map<string, LessonMedia>(
          live.map((l) => [l.id, { name: l.name, url: l.mediaUrl ?? null, youtube: l.source === 'youtube', videoId: l.youtubeVideoId ?? null }]),
        );
        const playable = new Set(live.filter((l) => canPlayLines(media.get(l.id))).map((l) => l.id));
        const rows = topMisses(docs, new Set(live.map((l) => l.id)), Number.MAX_SAFE_INTEGER);
        return { media, picked: pickDailyLines(rows, playable, Date.now()) };
      })
      .catch(() => ({ media: new Map<string, LessonMedia>(), picked: [] as MissRow[] })),
    getTalkStore()
      .listMistakes()
      .then((rows) => pickWarmup(rows).length)
      .catch(() => 0),
  ]);
  return { lines: lines.picked, media: lines.media, fixes };
}

/** Today's short review: hear and write a few missed lines, then fix a few Talk mistakes. */
export function DailyView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<Step>('start');
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadPlan().then((p) => {
      if (!alive) return;
      setDone(doneToday());
      setPlan(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!plan) return <p className="breathe text-sm text-gray-500">Loading…</p>;

  const finish = () => {
    markDone();
    setDone(true);
    setStep('done');
    // Lines written right left the list: "Again" gets a fresh plan.
    void loadPlan().then(setPlan);
  };
  const afterLines = () => (plan.fixes > 0 ? setStep('talk') : finish());
  const nextLine = () => (i + 1 < plan.lines.length ? setI(i + 1) : afterLines());
  const start = () => {
    setI(0);
    setRight(0);
    setTotal(plan.lines.length);
    if (plan.lines.length > 0) setStep('lines');
    else if (plan.fixes > 0) setStep('talk');
  };

  if (step === 'lines') {
    const row = plan.lines[i];
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400">
            Listen and write <span className="ml-1 text-xs text-gray-500 tabular-nums">{i + 1}/{plan.lines.length}</span>
          </h2>
          <button type="button" onClick={afterLines} className="text-xs text-gray-500 hover:text-gray-100">
            Skip
          </button>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/60">
          <MissPractice
            key={`${row.lessonId}:${row.sentenceId}`}
            row={row}
            lesson={plan.media.get(row.lessonId)}
            closeLabel="next"
            onClose={nextLine}
            onRight={() => {
              void clearMissFirestore(row.lessonId, row.sentenceId).catch(() => {});
              setRight((n) => n + 1);
              nextLine();
            }}
          />
        </div>
      </section>
    );
  }

  if (step === 'talk') return <TalkWarmup title="Fix your Talk mistakes" doneLabel="Finish" onDone={finish} />;

  const empty = plan.lines.length === 0 && plan.fixes === 0;
  return (
    <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      {step === 'done' ? (
        <p className="text-sm text-gray-100">
          Done for today.
          {total > 0 && (
            <span className="ml-1 text-gray-400 tabular-nums">
              {right}/{total} lines right.
            </span>
          )}
        </p>
      ) : empty ? (
        <p className="text-sm text-gray-400">Nothing to review today.</p>
      ) : (
        <>
          {done && <p className="text-sm text-gray-100">Done for today.</p>}
          <ul className="space-y-1 text-sm text-gray-300">
            {plan.lines.length > 0 && <li className="tabular-nums">{plan.lines.length} lines to hear and write</li>}
            {plan.fixes > 0 && <li className="tabular-nums">{plan.fixes} Talk mistakes to fix</li>}
          </ul>
          <button
            type="button"
            onClick={start}
            className={
              done
                ? 'w-full rounded-lg border border-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-100/[0.06]'
                : 'w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white'
            }
          >
            {done ? 'Again' : 'Start'}
          </button>
        </>
      )}
    </div>
  );
}
