// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createPlaybackClock } from '@/lib/playbackClock';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';

describe('playbackClock', () => {
  it('notifies subscribers only when the time changes', () => {
    const clock = createPlaybackClock();
    const seen: number[] = [];
    const off = clock.subscribe(() => seen.push(clock.get()));
    clock.set(1);
    clock.set(1);
    clock.set(2);
    off();
    clock.set(3);
    expect(seen).toEqual([1, 2]);
  });
});

describe('useMediaPlayer.reportPlaybackTime', () => {
  afterEach(() => vi.useRealTimers());

  it('moves the clock every call but page state only when forced or 250ms apart', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMediaPlayer());
    act(() => {
      vi.advanceTimersByTime(1000);
      result.current.reportPlaybackTime(1.0, false); // 1000ms since last sync -> state
    });
    expect(result.current.currentTime).toBe(1.0);

    act(() => {
      vi.advanceTimersByTime(16);
      result.current.reportPlaybackTime(1.016, false);
    });
    expect(result.current.clock.get()).toBe(1.016);
    expect(result.current.currentTime).toBe(1.0); // throttled

    act(() => {
      vi.advanceTimersByTime(16);
      result.current.reportPlaybackTime(1.032, true); // new sentence
    });
    expect(result.current.currentTime).toBe(1.032);

    act(() => {
      vi.advanceTimersByTime(260);
      result.current.reportPlaybackTime(1.3, false);
    });
    expect(result.current.currentTime).toBe(1.3);
  });

  it('setCurrentTime (seeks) updates clock and state at once', () => {
    const { result } = renderHook(() => useMediaPlayer());
    act(() => result.current.setCurrentTime(42));
    expect(result.current.currentTime).toBe(42);
    expect(result.current.clock.get()).toBe(42);
  });
});
