import React from 'react';
import { Plus, Video, Music2, PanelLeft } from 'lucide-react';
import type { LessonItem } from '@/types';
import { LessonProgressBars } from './LessonProgressBars';

interface WelcomeScreenProps {
  /** Most recently opened lessons first. */
  recentLessons: LessonItem[];
  /** Worked on, then left for a week (N9), longest left first. */
  listenAgainLessons: LessonItem[];
  onSelectLesson: (lesson: LessonItem) => void;
  onNewLesson: () => void;
  /** Phone only: the sidebar button sits in the title row, on the right so the title lines up with other pages. */
  onOpenSidebar?: () => void;
}

/** Start page: pick up a recent lesson, or create a new one. */
export function WelcomeScreen({ recentLessons, listenAgainLessons, onSelectLesson, onNewLesson, onOpenSidebar }: WelcomeScreenProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[38rem] px-1 pt-[max(1.75rem,calc(env(safe-area-inset-top)-0.75rem))] pb-10 sm:pb-16 md:px-4 md:pt-12 space-y-8">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-gray-100">noda</h1>
            {onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="-my-2 -mr-2 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white md:hidden"
                title="Open Sidebar"
                aria-label="Open sidebar"
              >
                <PanelLeft size={22} aria-hidden />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400">Listen, write what you hear, then speak along.</p>
        </div>

        <LessonList title="Continue learning" lessons={recentLessons} onSelect={onSelectLesson} />
        <LessonList title="Listen again" lessons={listenAgainLessons} onSelect={onSelectLesson} />

        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={onNewLesson}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-white"
          >
            <Plus size={16} aria-hidden /> New lesson
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonList({ title, lessons, onSelect }: { title: string; lessons: LessonItem[]; onSelect: (lesson: LessonItem) => void }) {
  if (lessons.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => onSelect(lesson)}
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
              <LessonProgressBars dictation={lesson.dictationProgress} shadowing={lesson.shadowingProgress} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
