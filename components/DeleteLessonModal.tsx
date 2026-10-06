'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DeleteLessonModalProps {
  lessonId: string;
  onCancel: () => void;
  onConfirmDelete: (id: string) => void | Promise<void>;
}

export function DeleteLessonModal({ lessonId, onCancel, onConfirmDelete }: DeleteLessonModalProps) {
  const [mounted, setMounted] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDeletePhrase('');
    setSubmitting(false);
  }, [lessonId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (!mounted) return null;

  const confirmDelete = async () => {
    if (deletePhrase !== 'Delete' || submitting) return;
    setSubmitting(true);
    try {
      await onConfirmDelete(lessonId);
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div
      role="presentation"
      className="app-modal-backdrop fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="noda-delete-lesson-title"
        className="app-modal-panel bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <Trash2 className="w-6 h-6 text-gray-100" />
        </div>
        <h3 id="noda-delete-lesson-title" className="text-xl font-bold text-white mb-2">
          Delete item?
        </h3>
        <p className="text-gray-400 mb-4 text-sm leading-relaxed">
          Can&apos;t be undone.
        </p>
        <div className="mb-6 grid gap-2">
          <label htmlFor="noda-delete-lesson-confirm" className="text-sm text-gray-300">
            Type <span className="font-mono font-semibold text-white">Delete</span> to confirm
          </label>
          <input
            id="noda-delete-lesson-confirm"
            autoComplete="off"
            autoFocus
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
            placeholder="Delete"
            aria-invalid={deletePhrase.length > 0 && deletePhrase !== 'Delete'}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={deletePhrase !== 'Delete' || submitting}
            onClick={() => void confirmDelete()}
          >
            {submitting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
