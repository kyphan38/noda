'use client';

import { useEffect, useState } from 'react';

import { GRADUATE_STREAK, patternLabel, type TalkMistake } from '@/lib/talk/mistake-bank';
import { getTalkStore } from '@/lib/talk/store';

/** Mistakes from Talk, grouped by pattern; open ones first. Shows nothing until there are some. */
export function TalkMistakesList({ showEmpty = false }: { showEmpty?: boolean }) {
  const [rows, setRows] = useState<TalkMistake[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .listMistakes()
      .then((r) => alive && setRows(r.sort((a, b) => Number(a.graduated) - Number(b.graduated) || b.hits - a.hits)))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!rows) return null;
  if (rows.length === 0) return showEmpty ? <p className="text-sm text-gray-500">No Talk mistakes yet.</p> : null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">Talk</h2>
      <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
        {rows.map((m) => (
          <li key={m.pattern} className={m.graduated ? 'opacity-50' : ''}>
            <button type="button" onClick={() => setOpen(open === m.pattern ? null : m.pattern)} className="flex w-full items-baseline gap-3 px-4 py-3 text-left hover:bg-gray-800/60">
              <span className="min-w-0 flex-1 text-sm text-gray-100">{patternLabel(m.pattern)}</span>
              <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                {m.graduated ? 'done' : `${m.hits} ${m.hits === 1 ? 'time' : 'times'} · ${m.cleanStreak}/${GRADUATE_STREAK} right`}
              </span>
            </button>
            {open === m.pattern && (
              <ul className="space-y-2 px-4 pb-3">
                {m.examples.slice(0, 5).map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-gray-500 line-through">{e.wrong}</span>
                    <span className="mx-1.5 text-gray-500">→</span>
                    <span className="font-medium text-gray-100">{e.right}</span>
                    {e.why && <span className="block text-xs text-gray-400">{e.why}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
