import React from 'react';

interface DeckCardProps {
  id: string;
  name: string;
  cardCount: number;
  language: 'en' | 'de' | 'mixed';
  onClick: () => void;
}

export function DeckCard({ id, name, cardCount, language, onClick }: DeckCardProps) {
  const languageFlag: Record<string, string> = {
    en: '🇬🇧',
    de: '🇩🇪',
    mixed: '🌐'
  };
  
  return (
    <div 
      className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-emerald-500 hover:scale-[1.02] transition-all mb-2" 
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎴</span>
          <span className="font-medium text-gray-200 text-sm truncate">{name}</span>
        </div>
        <span className="text-sm" title={language}>{languageFlag[language] || '🌐'}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <span>{cardCount} cards</span>
      </div>
    </div>
  );
}
