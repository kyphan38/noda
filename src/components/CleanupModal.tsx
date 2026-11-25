'use client';

import React, { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalShell } from '@/components/ModalShell';
import { LessonTalkModal } from '@/components/LessonTalkModal';
import type { Sentence } from '@/types';

interface CleanupModalProps {
  isOpen: boolean;
  onKeep: () => void;
  /** Moves the lesson to the trash, where it can still be restored. */
  onMoveToTrash: () => void | Promise<void>;
  /** The finished lesson and its sentences, for Retell and Talk. */
  lesson?: { id: string; name: string } | null;
  transcript?: Sentence[];
}

/** Shown once a lesson is finished in both dictation and shadowing. */
export function CleanupModal({ isOpen, onKeep, onMoveToTrash, lesson = null, transcript = [] }: CleanupModalProps) {
  const [mounted, setMounted] = useState(false);
  const [retell, setRetell] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;
  // Retelling keeps the lesson, like Keep.
  if (retell && lesson)
    return (
      <LessonTalkModal
        lesson={lesson}
        transcript={transcript}
        onClose={() => {
          setRetell(false);
          onKeep();
        }}
      />
    );

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
        {lesson && transcript.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            className="h-auto w-full justify-center rounded-xl py-3 text-base font-medium"
            onClick={() => setRetell(true)}
          >
            Speak about it
          </Button>
        )}
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
