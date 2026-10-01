import React from 'react';
import { Music2 } from 'lucide-react';

interface WelcomeScreenProps {
  onNewLesson: () => void;
}

export function WelcomeScreen({ onNewLesson }: WelcomeScreenProps) {
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

        <div className="max-w-sm mx-auto">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-colors group">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Music2 size={24} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Audio Lessons</h3>
            <p className="text-sm text-gray-400">Listen, practice dictation, or shadow native speakers</p>
          </div>
        </div>

        <div className="space-y-6 pt-8">
          <p className="text-gray-400">Get started by creating a new lesson</p>
          <div className="flex items-center justify-center">
            <button
              onClick={onNewLesson}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Music2 size={18} /> New Lesson
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
