import React from 'react';

export function LessonCardSkeleton() {
  return (
    <div className="lesson-card-skeleton ml-2 flex items-center gap-2 rounded-md border-l-2 border-l-transparent px-2 py-1.5">
      <div className="skeleton-shimmer h-3 w-3 shrink-0 rounded" />
      <div className="skeleton-shimmer h-3 flex-1 rounded min-w-0" />
      <div className="skeleton-shimmer h-3 w-6 shrink-0 rounded" />
      <div className="skeleton-shimmer h-4 w-4 shrink-0 rounded" />
    </div>
  );
}
