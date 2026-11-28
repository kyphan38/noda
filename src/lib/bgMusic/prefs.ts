// Background music settings, stored per device in localStorage (like Theme).
// Off by default: the app sounds the same until the owner turns it on.

import { clampVolume, DEFAULT_VOLUME } from './gain';

export type BgMusicPrefs = {
  enabled: boolean;
  /** Chosen track id, or null for the first default track. */
  trackId: string | null;
  /** Percent, 0..MAX_VOLUME. */
  volume: number;
};

export const DEFAULT_PREFS: BgMusicPrefs = { enabled: false, trackId: null, volume: DEFAULT_VOLUME };

const PREFS_KEY = 'noda.bgMusic';

/** Reads stored JSON; anything broken or missing falls back to the defaults. */
export function parsePrefs(raw: string | null): BgMusicPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof BgMusicPrefs, unknown>> | null;
    if (!v || typeof v !== 'object') return DEFAULT_PREFS;
    return {
      enabled: v.enabled === true,
      trackId: typeof v.trackId === 'string' && v.trackId ? v.trackId : null,
      volume: typeof v.volume === 'number' ? clampVolume(v.volume) : DEFAULT_VOLUME,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: BgMusicPrefs | null = null;

function read(): BgMusicPrefs {
  if (cache) return cache;
  try {
    cache = parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    // Safari private mode blocks localStorage.
    cache = DEFAULT_PREFS;
  }
  return cache;
}

/** For useSyncExternalStore: get() returns the same object until something changes. */
export const bgMusicPrefsStore = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get: read,
  getServer: (): BgMusicPrefs => DEFAULT_PREFS,
  set(patch: Partial<BgMusicPrefs>) {
    const next = parsePrefs(JSON.stringify({ ...read(), ...patch }));
    cache = next;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Not saved; the setting still works for this visit.
    }
    listeners.forEach((fn) => fn());
  },
};

export function resetBgMusicPrefsForTest(): void {
  cache = null;
  listeners.clear();
}
