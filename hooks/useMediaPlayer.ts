import { useState, useRef, useEffect } from 'react';
import { LoopMode, RepeatCount } from '@/types';
import { DEFAULT_LOOP_MODE, DEFAULT_REPEAT_COUNT } from '@/constants';

export function useMediaPlayer() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [loopMode, setLoopMode] = useState<LoopMode>(DEFAULT_LOOP_MODE);
  const [repeatCount, setRepeatCount] = useState<RepeatCount>(DEFAULT_REPEAT_COUNT);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoopDelayingRef = useRef<boolean>(false);
  const loopModeRef = useRef<LoopMode>(loopMode);
  const repeatCountRef = useRef<RepeatCount>(repeatCount);
  const sentencePlayCountRef = useRef<number>(0);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

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

  const changeSpeed = (speed: number) => {
    const clamped = Math.round(Math.max(0, Math.min(2, speed)) * 100) / 100;
    setPlaybackRate(clamped);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = clamped;
    }
  };

  const toggleLoopMode = () => {
    setLoopMode((prev) => (prev === 'none' ? 'one' : 'none'));
  };

  const changeRepeatCount = (count: RepeatCount) => {
    setRepeatCount(count);
    sentencePlayCountRef.current = 0;
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
    repeatCount,
    repeatCountRef,
    sentencePlayCountRef,
    mediaRef,
    loopTimeoutRef,
    isLoopDelayingRef,
    loopModeRef,
    handleMediaUpload,
    togglePlayPause,
    handleSeek,
    changeSpeed,
    toggleLoopMode,
    changeRepeatCount,
  };
}
