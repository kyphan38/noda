import React from 'react';
import { Music2, Layers } from 'lucide-react';

interface WelcomeScreenProps {
  onNewLesson: () => void;
  onNewDeck: () => void;
  /** Hide audio-lesson entry points (mobile decks-only layout). */
  hideAudio?: boolean;
}

export function WelcomeScreen({ onNewLesson, onNewDeck, hideAudio = false }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-12">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Welcome to noda
          </h1>
          <p className="text-xl text-gray-400">
            Your AI-powered language learning companion
          </p>
        </div>

        <div
          className={`grid gap-6 max-w-2xl mx-auto ${hideAudio ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}
        >
          {!hideAudio && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-colors group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Music2 size={24} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Audio Lessons</h3>
              <p className="text-sm text-gray-400">Listen, practice dictation, or shadow native speakers</p>
            </div>
          )}

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-colors group">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Layers size={24} className="text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Flashcard Decks</h3>
            <p className="text-sm text-gray-400">Review vocabulary and build fluency</p>
          </div>
        </div>

        <div className="space-y-6 pt-8">
          <p className="text-gray-400">
            Get started by creating a new lesson or flashcard deck
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!hideAudio && (
              <button
                onClick={onNewLesson}
                className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Music2 size={18} /> New Lesson
              </button>
            )}
            <button
              onClick={onNewDeck}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Layers size={18} /> New Deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
