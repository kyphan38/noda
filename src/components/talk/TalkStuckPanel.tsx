'use client';

import { useState } from 'react';

import { TalkHelp } from '@/components/talk/TalkHelp';
import { STALL_PHRASES } from '@/lib/talk/session';
import type { TalkPhrase } from '@/lib/talk/types';

const TABS = [
  { id: 'ideas', label: 'Ideas' },
  { id: 'phrases', label: 'Phrases' },
  { id: 'pause', label: 'Buy time' },
  { id: 'help', label: 'Help' },
] as const;
type Tab = (typeof TABS)[number]['id'];

type Props = { topicId: string; line: string; ideas: string[]; phrases: TalkPhrase[] };

/**
 * Every hint in one place, lightest first: what to talk about, set phrases,
 * ways to pause, then words for your own idea. Never a full answer.
 */
export function TalkStuckPanel({ topicId, line, ideas, phrases }: Props) {
  const tabs = TABS.filter((t) => (t.id === 'ideas' ? ideas.length > 0 : t.id === 'phrases' ? phrases.length > 0 : true));
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'help');
  const chip = 'rounded-md px-2 py-0.5 text-xs';

  return (
    <div className="space-y-2 rounded-lg border border-gray-800 p-3">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${chip} ${tab === t.id ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ideas' && (
        <ul className="list-disc pl-5 text-sm text-gray-300">
          {ideas.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      {tab === 'phrases' && (
        <div className="flex flex-wrap gap-1.5">
          {phrases.map((p) => (
            <span key={p.id} className={`${chip} bg-gray-800 text-gray-200`}>
              {p.text}
            </span>
          ))}
        </div>
      )}
      {tab === 'pause' && (
        <div className="flex flex-wrap gap-1.5">
          {STALL_PHRASES.map((p) => (
            <span key={p} className={`${chip} border border-gray-800 text-gray-300`}>
              {p}
            </span>
          ))}
        </div>
      )}
      {tab === 'help' && <TalkHelp key={line} topicId={topicId} aiLine={line} />}
    </div>
  );
}
