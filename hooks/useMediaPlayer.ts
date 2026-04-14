import { useState, useRef, useEffect } from 'react';
import { LoopMode } from '@/types';
import { DEFAULT_LOOP_MODE } from '@/constants';
import { getNextPlaybackSpeed } from '@/lib/utils';

export function useMediaPlayer() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [loopMode, setLoopMode] = useState<LoopMode>(DEFAULT_LOOP_MODE);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoopDelayingRef = useRef<boolean>(false);
  const loopModeRef = useRef<LoopMode>(loopMode);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  useEffect(() => {
    setIsPlaying(false);
    if (mediaRef.current) {
      mediaRef.current.pause();
    }
  }, [mediaURL]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaURL((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setMediaFile(file);
    }
  };

  const togglePlayPause = () => {
    if (mediaRef.current) {
      if (mediaRef.current.paused) {
        mediaRef.current.play().catch(() => {});
      } else {
        mediaRef.current.pause();
      }
    }
  };

  const handleSeek = (time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
      setCurrentTime(time);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
    }
  };

  const changeSpeed = () => {
    const nextSpeed = getNextPlaybackSpeed(playbackRate);
    setPlaybackRate(nextSpeed);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleLoopMode = () => {
    setLoopMode((prev) => (prev === 'none' ? 'one' : 'none'));
  };

  return {
    mediaFile,
    setMediaFile,
    mediaURL,
    setMediaURL,
    duration,
    setDuration,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    playbackRate,
    loopMode,
    setLoopMode,
    mediaRef,
    loopTimeoutRef,
    isLoopDelayingRef,
    loopModeRef,
    handleMediaUpload,
    togglePlayPause,
    handleSeek,
    changeSpeed,
    toggleLoopMode,
  };
}
