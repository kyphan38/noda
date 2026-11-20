'use client';

import { useState } from 'react';
import { Volume2, Zap } from 'lucide-react';

import { TalkStuckPanel } from '@/components/talk/TalkStuckPanel';
import { speak } from '@/lib/talk/speak';
import { noLongDash } from '@/lib/talk/text';
import type { TalkPhrase } from '@/lib/talk/types';

type Props = {
  topicId: string;
  name: string;
  text: string;
  curveball: boolean;
  kind?: 'question' | 'share' | 'invite';
  ideas: string[];
  hints: TalkPhrase[];
  showText: boolean;
  onToggleText: () => void;
  /** In review: the line you answered, without the tools. */
  quiet?: boolean;
};

/** What the partner just said: plain text, no box, with Play, Hide text and Stuck? under it. */
export function TalkLine({ topicId, name, text: raw, curveball, kind, ideas, hints, showText, onToggleText, quiet }: Props) {
  const [stuck, setStuck] = useState(false);
  const text = noLongDash(raw);
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {name}
        {curveball && (
          <span className="ml-1.5 inline-flex items-center gap-0.5">
            · <Zap className="h-3 w-3" /> curveball
          </span>
        )}
      </p>
      {showText || quiet ? <p className={`${quiet ? 'text-base' : 'text-lg'} leading-relaxed text-gray-100`}>{text}</p> : <p className="text-sm italic text-gray-500">Listen, then answer.</p>}
      {!quiet && kind && kind !== 'question' && !curveball && (
        <p className="text-xs text-gray-500">{kind === 'share' ? 'Your turn: react or add your view' : 'Your turn: ask them something'}</p>
      )}
      {!quiet && (
        <div className="flex gap-4 text-xs text-gray-400">
          <button type="button" aria-label="Play" onClick={() => speak(text)} className="hover:text-gray-100">
            <Volume2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleText} className="hover:text-gray-100">
            {showText ? 'Hide text' : 'Show text'}
          </button>
          <button type="button" onClick={() => setStuck((v) => !v)} className={stuck ? 'text-gray-100' : 'hover:text-gray-100'}>
            Stuck?
          </button>
        </div>
      )}
      {!quiet && stuck && <TalkStuckPanel key={text} topicId={topicId} line={text} ideas={ideas} phrases={hints} />}
    </div>
  );
}
