// noda - Talk: settings kept on this device (localStorage). Every read and
// write is guarded: private mode can block storage, and Talk still works.

import type { TalkMode } from './types';

const PREFS_KEY = 'noda.talk.prefs';

export type TalkPrefs = { mode: TalkMode; selfRepair: boolean; showText: boolean; quick: boolean };
export const DEFAULT_PREFS: TalkPrefs = { mode: 'instant', selfRepair: true, showText: true, quick: false };

export function readPrefs(): TalkPrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<TalkPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: TalkPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Kept for this visit only.
  }
}

const lastScenarioKey = (topicId: string) => `noda.talk.lastScenario.${topicId}`;

export function readLastScenario(topicId: string): string | undefined {
  try {
    return localStorage.getItem(lastScenarioKey(topicId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeLastScenario(topicId: string, scenarioId: string): void {
  try {
    localStorage.setItem(lastScenarioKey(topicId), scenarioId);
  } catch {
    // The next talk may repeat this situation.
  }
}
