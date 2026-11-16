'use client';

import { useCallback } from 'react';

import { restoreLessonFirestore, trashLessonFirestore } from '@/lib/db';

/** Trash, restore and "delete forever" (which only opens the confirm dialog). */
export function useLessonTrash({
  selectedId,
  onSelectedTrashed,
  onError,
  askDeleteForever,
}: {
  selectedId: string | undefined;
  /** The open lesson went to the trash: leave it. */
  onSelectedTrashed: () => void;
  onError: (message: string) => void;
  askDeleteForever: (ids: string[]) => void;
}) {
  const handleTrashItem = useCallback(async (id: string) => {
    try {
      await trashLessonFirestore(id);
      if (selectedId === id) {
        onSelectedTrashed();
      }
    } catch {
      onError('Could not move item to trash.');
    }
  }, [selectedId, onSelectedTrashed, onError]);

  const handleRestoreItem = useCallback(async (id: string) => {
    try {
      await restoreLessonFirestore(id);
    } catch {
      onError('Could not restore item.');
    }
  }, [onError]);

  const handleDeleteForeverMany = useCallback((ids: string[]) => {
    askDeleteForever(ids);
  }, [askDeleteForever]);

  return { handleTrashItem, handleRestoreItem, handleDeleteForeverMany };
}
