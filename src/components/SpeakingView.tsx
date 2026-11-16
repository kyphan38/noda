'use client';

import { useEffect, useState } from 'react';

import { ScoreChart } from '@/components/ScoreChart';
import { listAllSpeakingAttemptsFirestore } from '@/lib/db';
import { dailyScores, topHabits, topWords, type Habit, type ScorePoint, type WordMiss } from '@/lib/speaking-stats';

type Stats = { days: ScorePoint[]; habits: Habit[]; words: WordMiss[]; total: number };

/** Speaking over time (N5) and the sound habits that keep going wrong (N6), from every speaking check. */
export function SpeakingView() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    listAllSpeakingAttemptsFirestore()
      .then((all) => {
        if (!alive) return;
        setStats({ days: dailyScores(all), habits: topHabits(all, 5), words: topWords(all, 5), total: all.length });
      })
      .catch(() => alive && setStats({ days: [], habits: [], words: [], total: 0 }));
    return () => {
      alive = false;
    };
  }, []);

  if (!stats) return <p className="breathe text-sm text-gray-500">Loading…</p>;
  if (stats.total === 0) return <p className="text-sm text-gray-400">No speaking checks yet. Start one from the player in Shadowing.</p>;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Score by day</h2>
        <ScoreChart points={stats.days} label="latest day" />
        <p className="text-xs text-gray-500 tabular-nums">
          {stats.total} {stats.total === 1 ? 'check' : 'checks'} on {stats.days.length} {stats.days.length === 1 ? 'day' : 'days'}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Sounds to practise</h2>
        {stats.habits.length === 0 ? (
          <p className="text-sm text-gray-400">Every sound habit came through so far.</p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
            {stats.habits.map((h) => (
              <li key={h.label} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 text-gray-100">{h.label}</span>
                <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                  missed {h.misses} of {h.checks}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stats.words.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Words said wrong</h2>
          <p className="text-sm text-gray-300">
            {stats.words.map((w) => `${w.word} (${w.times})`).join(' · ')}
          </p>
        </section>
      )}
    </div>
  );
}
