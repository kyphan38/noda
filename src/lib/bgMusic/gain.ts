// Pure rules for background music: when it plays, how loud, and how fast it moves.
// Plan: PLAN-bg-music.md.

import type { AppMode } from '@/types';

/** Volume is a percent of full scale. Kept low: the lesson voice must stay clear. */
export const DEFAULT_VOLUME = 12;
export const MAX_VOLUME = 40;

/** While the lesson clip plays, music keeps this share of its volume. A light dip, not a cut. */
export const DUCK_FACTOR = 0.6;

export const FADE_IN_MS = 800;
export const FADE_OUT_MS = 450;
export const DUCK_MS = 300;

/** Lesson tabs that may have music. Talk and Speaking never do. */
const MUSIC_MODES: ReadonlySet<AppMode> = new Set<AppMode>(['listen', 'dictation', 'shadowing']);

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(0, Math.round(v)));
}

export type PlayState = {
  enabled: boolean;
  /** Current lesson tab, or null when not on a lesson page. */
  mode: AppMode | null;
  /** The mic is in use (Speaking check open): music must stop, not only dip. */
  micOpen: boolean;
};

export function shouldPlay({ enabled, mode, micOpen }: PlayState): boolean {
  return enabled && !micOpen && mode !== null && MUSIC_MODES.has(mode);
}

/** Gain (0..1) to aim for. 0 when music should not sound. */
export function targetGain(volume: number, ducked: boolean, playing: boolean): number {
  if (!playing) return 0;
  const base = clampVolume(volume) / 100;
  return ducked ? base * DUCK_FACTOR : base;
}

/** How long to move from one gain to the next: fade in, fade out, or a duck step. */
export function rampMs(from: number, to: number): number {
  if (to === 0) return FADE_OUT_MS;
  if (from === 0) return FADE_IN_MS;
  return DUCK_MS;
}
