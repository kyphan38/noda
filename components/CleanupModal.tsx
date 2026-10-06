'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CleanupModalProps {
  isOpen: boolean;
  onKeep: () => void;
  /** Moves the lesson to the trash, where it can still be restored. */
  onMoveToTrash: () => void | Promise<void>;
}

/** Shown once a lesson is finished in both dictation and shadowing. */
export function CleanupModal({ isOpen, onKeep, onMoveToTrash }: CleanupModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onKeep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onKeep]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      role="presentation"
      className="app-modal-backdrop fixed inset-0 bg-black/80 z-[190] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKeep();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="noda-cleanup-title"
        className="app-modal-panel bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <PartyPopper className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
        </div>
        <h3 id="noda-cleanup-title" className="text-xl font-bold text-white mb-2">
          Lesson complete!
        </h3>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          Keep it to review, or move it to trash.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="default"
            className="h-auto w-full justify-center rounded-xl py-3 text-base font-medium"
            onClick={onKeep}
            autoFocus
          >
            Keep
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-auto w-full justify-center rounded-xl py-3 text-base font-medium"
            onClick={() => void onMoveToTrash()}
          >
            Move to trash
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
