import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

/** Two thin bars, dictation over shadowing; a check once both reach 100%. */
export function LessonProgressBars({ dictation, shadowing }: { dictation: number; shadowing: number }) {
  const label = `Dictation ${dictation}% · Shadowing ${shadowing}%`;

  // The check pops only when the lesson completes while it is on screen. A list that loads
  // with finished lessons mounts them already complete, so they show the check still.
  const complete = dictation === 100 && shadowing === 100;
  const [prevComplete, setPrevComplete] = useState(complete);
  const [justComplete, setJustComplete] = useState(false);
  if (complete !== prevComplete) {
    setPrevComplete(complete);
    setJustComplete(complete);
  }

  if (dictation === 0 && shadowing === 0) return <span className="w-7 shrink-0" />;
  if (complete) {
    return (
      <span title="Lesson complete" className="inline-flex w-7 shrink-0 justify-end" role="img" aria-label="Lesson complete">
        <CheckCircle2 size={14} className={`shrink-0 text-gray-300${justComplete ? ' pop' : ''}`} aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex w-7 shrink-0 flex-col gap-[3px]" title={label} role="img" aria-label={label}>
      {[dictation, shadowing].map((value, i) => (
        <span key={i} className="h-[3px] w-full overflow-hidden rounded-full bg-gray-700/70">
          {/* scaleX, not width: it fills smoothly when a sentence is finished. It starts at its
              value, so a bar that appears with the list does not animate. */}
          <span
            className="block h-full w-full origin-left rounded-full bg-gray-300"
            style={{ transform: `scaleX(${value / 100})`, transition: 'transform 600ms var(--ease-soft)' }}
          />
        </span>
      ))}
    </span>
  );
}
