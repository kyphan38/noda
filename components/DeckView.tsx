import React from 'react';
import { DeckItem } from '@/types';

interface DeckViewProps {
  deck: DeckItem;
}

export function DeckView({ deck }: DeckViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-2xl border border-gray-800 p-8">
      <div className="text-center space-y-4 max-w-md mx-auto">
        <div className="text-6xl animate-bounce">🎴</div>
        <h2 className="text-2xl font-bold text-white">Flashcard Placeholder</h2>
        <p className="text-gray-400">
          Deck: <span className="text-white font-medium">{deck.name}</span>
        </p>
        <p className="text-gray-400">
          This section will contain the flashcard UI for reviewing vocabulary and sentences.
        </p>
        <div className="mt-6 p-4 bg-gray-800/50 rounded-xl flex gap-6 justify-center">
          <p className="text-gray-300">{deck.cardCount} cards</p>
          <p className="text-gray-300">
            Language: {deck.language === 'en' ? '🇬🇧 English' : deck.language === 'de' ? '🇩🇪 German' : '🌐 Mixed'}
          </p>
        </div>
      </div>
    </div>
  );
}
