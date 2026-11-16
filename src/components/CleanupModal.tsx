'use client';

import React, { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalShell } from '@/components/ModalShell';

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

  if (!isOpen || !mounted) return null;

  const content = (
    <ModalShell
      onClose={onKeep}
      labelledBy="noda-cleanup-title"
      backdropClassName="bg-black/80 z-[190] p-4 backdrop-blur-sm"
      panelClassName="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full text-center"
      portal
    >
      {/* The icon pops in after the panel, and one thin ring spreads out from it once. */}
      <div
        className="pop relative w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4"
        style={{ animationDelay: '120ms' }}
      >
        <span aria-hidden className="ring-out absolute inset-0 rounded-full border border-gray-500" />
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
    </ModalShell>
  );

  return content;
}
