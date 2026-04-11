import React from 'react';
import { DeckItem } from '@/types';

interface DeckCardProps {
  deck: DeckItem;
  selectedItemId?: string;
  onItemSelect: (item: DeckItem) => void;
}

export function DeckCard({ deck, selectedItemId, onItemSelect }: DeckCardProps) {
  const languageFlag: Record<string, string> = {
    en: '🇬🇧',
    de: '🇩🇪',
    mixed: '🌐'
  };
  
  return (
    <div 
      className={`bg-gray-800/50 border rounded-lg p-3 cursor-pointer hover:border-emerald-500 hover:scale-[1.02] transition-all mb-2 deck-card ${selectedItemId === deck.id ? 'active border-emerald-500 bg-emerald-500/10' : 'border-gray-700'}`} 
      onClick={() => onItemSelect(deck)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎴</span>
          <span className="font-medium text-gray-200 text-sm truncate">{deck.name}</span>
        </div>
        <span className="text-sm" title={deck.language}>{languageFlag[deck.language] || '🌐'}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <span>{deck.cardCount} cards</span>
      </div>
    </div>
  );
}
