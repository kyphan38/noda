import React from 'react';
import { Trash2 } from 'lucide-react';

interface TrashCardProps {
  id: string;
  name: string;
  originalType: 'lesson' | 'deck';
  language: string;
  onDeletePermanently: (id: string) => void;
}

export function TrashCard({ id, name, originalType, language, onDeletePermanently }: TrashCardProps) {
  const typeIcon = originalType === 'lesson' ? '🎧' : '🎴';
  const langLabel = language?.toUpperCase() || '—';

  return (
    <div className="group flex items-center gap-2 min-w-0 ml-2 px-2 py-1.5 rounded-lg bg-gray-900/50 border border-gray-800 mb-1 transition-colors duration-200">
      <span className="text-sm shrink-0 opacity-80" aria-hidden>
        {typeIcon}
      </span>
      <h4
        className="font-medium text-gray-200 text-sm truncate min-w-0 flex-1"
        title={name}
      >
        {name}
      </h4>
      <span className="text-xs text-gray-500 tabular-nums shrink-0">{langLabel}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeletePermanently(id);
        }}
        className="shrink-0 p-0.5 rounded text-gray-500 hover:text-red-400 opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        title="Delete permanently"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
