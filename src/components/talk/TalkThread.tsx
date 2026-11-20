'use client';

import { useState } from 'react';

import { noLongDash } from '@/lib/talk/text';

type Pair = { ai: string; you: string };

/**
 * Earlier lines of the talk, quieter than the current one but easy to read:
 * up to two lines each, the speaker on the left. Phone: the last exchange, the
 * rest folded under "Earlier (n)". Wide screens: every line.
 */
export function TalkThread({ name, pairs }: { name: string; pairs: Pair[] }) {
  const [open, setOpen] = useState(false);
  if (pairs.length === 0) return null;
  const older = pairs.length - 1;
  const line = (who: string, text: string, mine: boolean, key: string, hideOnPhone: boolean) => (
    <div key={key} className={`flex gap-3 text-sm leading-snug ${hideOnPhone ? 'hidden md:flex' : ''}`}>
      <span className={`w-14 shrink-0 truncate text-xs leading-5 ${mine ? 'text-gray-400' : 'text-gray-500'}`}>{who}</span>
      <span className={`line-clamp-2 ${mine ? 'text-gray-300' : 'text-gray-400'}`}>{noLongDash(text)}</span>
    </div>
  );
  return (
    <div className="space-y-2">
      {older > 0 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300 md:hidden">
          Earlier ({older}) {open ? '▴' : '▾'}
        </button>
      )}
      {pairs.flatMap((p, i) => {
        const hide = i < older && !open;
        return [line(name, p.ai, false, `a${i}`, hide), line('You', p.you, true, `y${i}`, hide)];
      })}
    </div>
  );
}
