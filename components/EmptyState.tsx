import React from 'react';
import { Music2 } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="empty-state text-center py-8 px-4 opacity-90">
      <Music2 size={40} strokeWidth={1.5} className="mx-auto mb-4 text-gray-600" aria-hidden />
      <h3 className="text-sm font-semibold text-gray-300 mb-2">No audio lessons</h3>
      <p className="text-sm text-gray-400 max-w-[220px] mx-auto">
        Click the &apos;+ Audio&apos; button above to add a lesson.
      </p>
    </div>
  );
}
