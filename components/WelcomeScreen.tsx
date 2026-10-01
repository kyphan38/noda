import React from 'react';
import { Plus, Video, Music2 } from 'lucide-react';
import type { LessonItem } from '@/types';
import { LessonProgressBars } from './LessonProgressBars';

interface WelcomeScreenProps {
  /** Most recently opened lessons first. */
  recentLessons: LessonItem[];
  onSelectLesson: (lesson: LessonItem) => void;
  onNewLesson: () => void;
}

/** Start page: pick up a recent lesson, or create a new one. */
export function WelcomeScreen({ recentLessons, onSelectLesson, onNewLesson }: WelcomeScreenProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-2 py-10 sm:py-16 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-100">noda</h1>
          <p className="text-sm text-gray-400">Listen, write what you hear, then speak along.</p>
        </div>

        {recentLessons.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Continue learning</h2>
            <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
              {recentLessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => onSelectLesson(lesson)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/60"
                  >
                    <span className="shrink-0 text-gray-500" aria-hidden>
                      {lesson.mediaType === 'video' ? <Video size={16} /> : <Music2 size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-100">{lesson.name}</span>
                      <span className="block text-xs text-gray-500 tabular-nums">
                        Dictation {lesson.dictationProgress}% · Shadowing {lesson.shadowingProgress}%
                      </span>
                    </span>
                    <LessonProgressBars
                      dictation={lesson.dictationProgress}
                      shadowing={lesson.shadowingProgress}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={onNewLesson}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-white"
        >
          <Plus size={16} aria-hidden /> New lesson
        </button>
      </div>
    </div>
  );
}
