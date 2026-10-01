'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CleanupModalProps {
  isOpen: boolean;
  onKeep: () => void;
  onRemoveAudio?: () => void | Promise<void>;
}

export function CleanupModal({
  isOpen,
  onKeep,
  onRemoveAudio,
}: CleanupModalProps) {
  const [mounted, setMounted] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) setConfirmPhrase('');
  }, [isOpen]);


  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onKeep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onKeep]);

  if (!isOpen || !mounted) return null;

  const destructiveDisabled = confirmPhrase !== 'Delete';

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
        <p className="text-gray-400 mb-4 text-sm leading-relaxed">
          You&apos;ve finished dictation and shadowing for every sentence. Remove this lesson from this device to free space?
          Transcript and progress will be deleted from this browser.
        </p>
        <div className="mb-4 grid gap-2 text-left">
          <label htmlFor="noda-cleanup-lesson-confirm" className="text-sm text-gray-300">
            Type <span className="font-mono font-semibold text-white">Delete</span> to enable removal
          </label>
          <input
            id="noda-cleanup-lesson-confirm"
            autoComplete="off"
            autoFocus
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder="Delete"
            aria-invalid={confirmPhrase.length > 0 && confirmPhrase !== 'Delete'}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
          />
        </div>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="default"
            className="h-auto w-full justify-center rounded-xl py-3 text-base font-medium"
            disabled={destructiveDisabled}
            onClick={() => void onRemoveAudio?.()}
          >
            Remove lesson
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-auto w-full justify-center rounded-xl py-3 text-base font-medium"
            onClick={onKeep}
          >
            Keep files
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
