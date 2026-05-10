import React from 'react';
import { Trash2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { LessonSummary } from '@/types';

interface TrashSectionProps {
  lessons: LessonSummary[];
  isExpanded: boolean;
  onToggleSection: (expanded: boolean) => void;
  onDeletePermanently: (id: string) => void;
}

export function TrashSection({
  lessons,
  isExpanded,
  onToggleSection,
  onDeletePermanently
}: TrashSectionProps) {
  const trashedLessons = lessons.filter((l) => l.isTrashed);

  return (
    <div className="space-y-1">
      <button
        onClick={() => onToggleSection(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Trash2 size={14} />
          Trash
        </span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      
      {isExpanded && trashedLessons.length > 0 ? (
        trashedLessons.map((lesson) => (
          <div
            key={lesson.id}
            className="p-3 ml-2 rounded-lg bg-gray-900/50 border border-gray-800 group"
          >
            <div className="flex justify-between items-start mb-2">
              <h4
                className="font-medium text-gray-200 text-sm truncate pr-2"
                title={lesson.name}
              >
                {lesson.name}
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePermanently(lesson.id);
                }}
                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete permanently"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <CheckCircle2
                  size={12}
                  className={lesson.progress === 100 ? 'text-green-400' : ''}
                />
                {lesson.progress}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${
                  lesson.progress === 100 ? 'bg-green-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${lesson.progress}%` }}
              ></div>
            </div>
          </div>
        ))
      ) : isExpanded ? (
        <div className="px-5 py-2 text-sm text-gray-600 italic">
          Trash is empty.
        </div>
      ) : null}
    </div>
  );
}
