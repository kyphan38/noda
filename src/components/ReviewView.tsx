'use client';

import { useEffect, useState } from 'react';

import { DailyView } from '@/components/DailyView';
import { MistakesView } from '@/components/MistakesView';
import { SpeakingView } from '@/components/SpeakingView';
import { TalkMistakesList } from '@/components/talk/TalkMistakesList';
import { TalkStarredList } from '@/components/talk/TalkStarredList';
import { REVIEW_TABS, reviewTabFromSearch, type ReviewTab } from '@/lib/nav';
import { cn } from '@/lib/utils';

type Source = 'all' | 'talk' | 'dictation';
const SOURCES: { id: Source; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'talk', label: 'Talk' },
  { id: 'dictation', label: 'Dictation' },
];

export const chipClass = (on: boolean) =>
  cn(
    'shrink-0 rounded-lg border px-2.5 py-1 text-xs transition-colors',
    on ? 'border-gray-500 bg-gray-800 text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'
  );

/** Everything to look back on: today's review, mistakes, speaking scores and starred phrases. */
export function ReviewView() {
  const [tab, setTab] = useState<ReviewTab>('today');
  const [source, setSource] = useState<Source>('all');

  useEffect(() => {
    // Every visit starts on Today; a ?tab= link (old /speaking page) opens that tab.
    const next = reviewTabFromSearch(window.location.search);
    if (next) setTab(next);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex gap-1" role="tablist">
        {REVIEW_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={chipClass(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && <DailyView />}
      {tab === 'mistakes' && (
        <div className="space-y-5">
          <div className="flex gap-1" role="radiogroup" aria-label="Source">
            {SOURCES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={source === s.id} onClick={() => setSource(s.id)} className={chipClass(source === s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          {source !== 'dictation' && <TalkMistakesList showEmpty={source === 'talk'} />}
          {source !== 'talk' && (
            <section className="space-y-2">
              {source === 'all' && <h2 className="text-sm font-medium text-gray-400">Dictation</h2>}
              <MistakesView />
            </section>
          )}
        </div>
      )}
      {tab === 'speaking' && <SpeakingView />}
      {tab === 'starred' && <TalkStarredList open />}
    </div>
  );
}
