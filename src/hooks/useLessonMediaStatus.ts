'use client';

import React, { useEffect, useState } from 'react';

type Options = {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  mediaURL: string | null;
  lessonKey: string;
  /** True once the YouTube player holds mediaRef; the listeners attach again then. */
  youtubeReady: boolean;
  isVideoLesson: boolean;
  isMobile: boolean;
};

/**
 * Two warnings read from the lesson's media element: seeking is off while it buffers,
 * and a desktop video with no picture after 3s is likely HEVC the browser cannot decode.
 */
export function useLessonMediaStatus({ mediaRef, mediaURL, lessonKey, youtubeReady, isVideoLesson, isMobile }: Options) {
  const [seekDisabled, setSeekDisabled] = useState(false);
  const [hevcWarning, setHevcWarning] = useState(false);

  useEffect(() => {
    setSeekDisabled(false);
    setHevcWarning(false);
  }, [mediaURL, lessonKey]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onWaiting = () => setSeekDisabled(true);
    const onReady = () => setSeekDisabled(false);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onReady);
    el.addEventListener('canplay', onReady);
    el.addEventListener('canplaythrough', onReady);
    return () => {
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onReady);
      el.removeEventListener('canplay', onReady);
      el.removeEventListener('canplaythrough', onReady);
    };
  }, [mediaURL, lessonKey, mediaRef, youtubeReady]);

  useEffect(() => {
    if (!isVideoLesson || isMobile || !mediaURL) {
      setHevcWarning(false);
      return;
    }
    const el = mediaRef.current;
    if (!el || !(el instanceof HTMLVideoElement)) return;

    const check = () => {
      if (el.videoWidth > 0) setHevcWarning(false);
    };
    el.addEventListener('loadeddata', check);

    const timer = window.setTimeout(() => {
      if (mediaRef.current instanceof HTMLVideoElement && mediaRef.current.videoWidth === 0) {
        setHevcWarning(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('loadeddata', check);
    };
  }, [isVideoLesson, isMobile, mediaURL, lessonKey, mediaRef]);

  return { seekDisabled, hevcWarning };
}
