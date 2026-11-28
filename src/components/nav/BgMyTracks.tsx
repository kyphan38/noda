'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { BgWords } from '@/components/nav/BgWords';
import { bgUploadStore, cancelBgUpload, clearBgUploadError, deleteBgTrack, uploadBgTrack } from '@/lib/db';
import type { BgTrack } from '@/lib/bgMusic/tracks';

const link = 'text-gray-500 hover:text-gray-100';

/** The "mine" group in Settings: own tracks, add one, delete one (tap twice). */
export function BgMyTracks({
  tracks,
  value,
  onPick,
  onDeleted,
}: {
  tracks: BgTrack[];
  value: string | undefined;
  onPick: (id: string) => void;
  /** The chosen track was deleted: the choice goes back to the default. */
  onDeleted: () => void;
}) {
  const upload = useSyncExternalStore(bgUploadStore.subscribe, bgUploadStore.get, bgUploadStore.getServer);
  const input = useRef<HTMLInputElement>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const selected = tracks.find((t) => t.id === value);

  // A second tap must follow soon, or the delete goes back to its first step.
  useEffect(() => {
    if (!confirmId) return;
    const timer = window.setTimeout(() => setConfirmId(null), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmId]);

  const busy = upload.status === 'reading' || upload.status === 'uploading';

  return (
    <div className="flex flex-col gap-1.5">
      {tracks.length > 0 && <BgWords label="Track" items={tracks} value={value} onPick={onPick} />}
      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        {busy ? (
          <>
            <span className="truncate text-gray-300">
              {upload.status === 'reading' ? 'reading…' : `uploading ${Math.round(upload.progress * 100)}%`}
            </span>
            {upload.status === 'uploading' && (
              <button type="button" className={link} onClick={cancelBgUpload}>
                cancel
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className={link}
            onClick={() => {
              clearBgUploadError();
              input.current?.click();
            }}
          >
            add a track
          </button>
        )}
        {selected && !busy && (
          <button
            type="button"
            className={confirmId === selected.id ? 'text-gray-100' : link}
            onClick={() => {
              if (confirmId !== selected.id) return setConfirmId(selected.id);
              setConfirmId(null);
              void deleteBgTrack(selected).then(onDeleted);
            }}
          >
            {confirmId === selected.id ? `delete ${selected.name}?` : 'delete'}
          </button>
        )}
      </div>
      {upload.status === 'error' && <p className="text-xs text-gray-400">{upload.message}</p>}
      <input
        ref={input}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void uploadBgTrack(file).then((id) => id && onPick(id));
        }}
      />
    </div>
  );
}
