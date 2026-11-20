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
  const parts = [
    `${data.streak}-day streak`,
    `${week.talks} ${week.talks === 1 ? 'talk' : 'talks'}`,
    `${week.minutes} min`,
    `${week.wpm} words/min`,
  ];
  return (
    <p className="text-xs text-gray-500" title={week.topPatterns.map((p) => `${p.label}: ${p.n}`).join(', ')}>
      <span className="text-gray-300">This week</span> · {parts.join(' · ')}
      {week.topPatterns[0] && <> · most: {week.topPatterns[0].label}</>}
    </p>
  );
}
