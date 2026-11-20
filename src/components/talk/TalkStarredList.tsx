'use client';

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

import { stageLabel } from '@/lib/talk/phrase-stage';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkPhraseProgress } from '@/lib/talk/types';

/** Phrases you starred as fitting you, and how far each one is. Nothing until you star one. */
export function TalkStarredList({ open = false }: { open?: boolean }) {
  const [rows, setRows] = useState<TalkPhraseProgress[]>([]);

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .listStarred()
      .then((r) => alive && setRows(r.sort((a, b) => a.text.localeCompare(b.text))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (rows.length === 0) return open ? <p className="text-sm text-gray-500">Star phrases in a topic set to keep them here.</p> : null;
  const yours = rows.filter((r) => r.stage === 'active').length;
  return (
    <details className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3" open={open}>
      <summary className="cursor-pointer text-sm text-gray-100">
        Starred phrases <span className="ml-1 text-xs text-gray-500 tabular-nums">{yours}/{rows.length} yours</span>
      </summary>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={`${r.topicId}:${r.phraseId}`} className="flex items-center gap-2 text-sm">
            <button type="button" aria-label={`Play ${r.text}`} onClick={() => speak(r.text)} className="text-gray-500 hover:text-gray-100">
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-0 flex-1 text-gray-100">{r.text}</span>
            <span className={`text-xs ${r.stage === 'active' ? 'text-gray-100' : 'text-gray-500'}`}>{stageLabel(r.stage)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
