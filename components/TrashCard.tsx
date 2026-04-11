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
  
  return (
    <div className="p-3 ml-2 rounded-lg bg-gray-900/50 border border-gray-800 group mb-2">
      <div className="flex justify-between items-start mb-2">
        <h4
          className="font-medium text-gray-200 text-sm truncate pr-2 flex items-center gap-2"
          title={name}
        >
          <span>{typeIcon}</span>
          {name}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeletePermanently(id);
          }}
          className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete permanently"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{language.toUpperCase()}</span>
      </div>
    </div>
  );
}
