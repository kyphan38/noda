import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/** Two thin bars, dictation over shadowing; a check once both reach 100%. */
export function LessonProgressBars({ dictation, shadowing }: { dictation: number; shadowing: number }) {
  const label = `Dictation ${dictation}% · Shadowing ${shadowing}%`;
  if (dictation === 0 && shadowing === 0) return <span className="w-7 shrink-0" />;
  if (dictation === 100 && shadowing === 100) {
    return (
      <span title="Lesson complete" className="inline-flex w-7 shrink-0 justify-end" role="img" aria-label="Lesson complete">
        <CheckCircle2 size={14} className="shrink-0 text-gray-300" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex w-7 shrink-0 flex-col gap-[3px]" title={label} role="img" aria-label={label}>
      {[dictation, shadowing].map((value, i) => (
        <span key={i} className="h-[3px] w-full overflow-hidden rounded-full bg-gray-700/70">
          <span className="block h-full rounded-full bg-gray-300" style={{ width: `${value}%` }} />
        </span>
      ))}
    </span>
  );
}
