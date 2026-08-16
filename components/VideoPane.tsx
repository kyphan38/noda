'use client';

import React, { forwardRef } from 'react';

export interface VideoPaneProps {
  src: string | undefined;
  /** When true, video is visually hidden but stays in DOM (fixed 1px pin - Safari-friendly, avoids clipping controls). */
  videoHidden: boolean;
  /** When true (Focus Mode), the player expands to take up most of the available height. */
  expanded?: boolean;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
}

export const VideoPane = forwardRef<HTMLVideoElement, VideoPaneProps>(function VideoPane(
  { src, videoHidden, expanded = false, onLoadedMetadata, onEnded, onPlay, onPause, onError },
  ref
) {
  return (
    <div
      className={
        videoHidden
          ? 'relative w-full max-w-4xl mx-auto h-14 bg-slate-900/90 rounded-2xl border border-gray-800 overflow-hidden shrink-0 transition-[max-height] duration-300 ease-in-out'
          : expanded
          ? 'relative w-full h-full mx-auto bg-slate-900 rounded-2xl border border-gray-800 overflow-hidden transition-[height,width] duration-300 ease-in-out'
          : 'relative w-full max-w-4xl mx-auto bg-slate-900 rounded-2xl border border-gray-800 overflow-hidden shrink-0 aspect-video min-h-[180px] max-h-[35vh] transition-[max-height,max-width] duration-300 ease-in-out'
      }
    >
      <video
        ref={ref}
        src={src}
        playsInline
        preload="metadata"
        className={
          videoHidden
            ? 'fixed top-0 left-0 w-px h-px max-w-[1px] max-h-[1px] opacity-[0.03] pointer-events-none'
            : 'w-full h-full object-contain'
        }
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onError={onError}
      />
    </div>
  );
});
