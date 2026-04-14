'use client';

import React, { forwardRef } from 'react';

export interface VideoPaneProps {
  src: string | undefined;
  /** When true, video is visually hidden but stays in DOM (fixed 1px pin — Safari-friendly, avoids clipping controls). */
  videoHidden: boolean;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export const VideoPane = forwardRef<HTMLVideoElement, VideoPaneProps>(function VideoPane(
  { src, videoHidden, onLoadedMetadata, onEnded, onPlay, onPause },
  ref
) {
  return (
    <div
      className={
        videoHidden
          ? 'relative w-full max-w-4xl mx-auto h-14 bg-black/70 rounded-xl border border-gray-800 overflow-hidden shrink-0'
          : 'relative w-full max-w-4xl mx-auto bg-black rounded-xl border border-gray-800 overflow-hidden shrink-0 max-h-[38vh] min-h-[180px] aspect-video'
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
      />
    </div>
  );
});
