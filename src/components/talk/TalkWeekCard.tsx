'use client';

import { useEffect, useState } from 'react';

import { streak, weekSummary, type WeekSummary } from '@/lib/talk/stats';
import { getTalkStore } from '@/lib/talk/store';

/** Long enough back for any real streak, short enough to stay a small read. */
const LOOK_BACK_MS = 120 * 86_400_000;

/** This week's talking at a glance, and the streak. Nothing before the first talk. */
export function TalkWeekCard() {
  const [data, setData] = useState<{ week: WeekSummary; streak: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    getTalkStore()
      .listSessions(now - LOOK_BACK_MS)
      .then((sessions) => alive && setData({ week: weekSummary(sessions, now), streak: streak(sessions, now) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || (data.week.talks === 0 && data.streak === 0)) return null;
  const { week } = data;
  const stats = [
    { label: 'Streak', value: `${data.streak} ${data.streak === 1 ? 'day' : 'days'}` },
    { label: 'Talks', value: week.talks },
    { label: 'Minutes', value: week.minutes },
    { label: 'Words/min', value: week.wpm },
  ];
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">This week</h2>
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-900/60 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-lg text-gray-100 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      {week.topPatterns.length > 0 && (
        <p className="text-xs text-gray-500">
          Most common: {week.topPatterns.map((p) => `${p.label} (${p.n})`).join(', ')}
        </p>
      )}
    </section>
  );
}
