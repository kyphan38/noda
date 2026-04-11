import React from 'react';
import { PartyPopper } from 'lucide-react';

interface CleanupModalProps {
  isOpen: boolean;
  onKeep: () => void;
  onCleanup: () => void;
}

export function CleanupModal({ isOpen, onKeep, onCleanup }: CleanupModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <PartyPopper className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Congratulations!</h3>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          🎉 You've completed this lesson! Do you want to clean up media files to save space?
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onCleanup} 
            className="w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold transition-colors"
          >
            Clean Up (Move to Trash)
          </button>
          <button 
            onClick={onKeep} 
            className="w-full px-4 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 font-medium transition-colors"
          >
            Keep Files
          </button>
        </div>
      </div>
    </div>
  );
}
