'use client';

import { useState } from 'react';

type Pair = { ai: string; you: string };

/**
 * Earlier lines of the talk, small and grey. Phone: the last exchange, the rest
 * folded under "Earlier (n)". Wide screens: every line.
 */
export function TalkThread({ name, pairs }: { name: string; pairs: Pair[] }) {
  const [open, setOpen] = useState(false);
  if (pairs.length === 0) return null;
  const older = pairs.length - 1;
  const line = (who: string, text: string, mine: boolean, i: string, hideOnPhone: boolean) => (
    <p key={i} className={`truncate text-xs text-gray-500 ${mine ? 'text-right' : ''} ${hideOnPhone ? 'hidden md:block' : ''}`}>
      {who}: {text}
    </p>
  );
  return (
    <div className="space-y-1">
      {older > 0 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-gray-600 hover:text-gray-300 md:hidden">
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
