// The three spaces of the app and which one a path belongs to.

export type NavSpace = 'listen' | 'talk' | 'review';

export const NAV_SPACES: { id: NavSpace; label: string; href: string }[] = [
  { id: 'listen', label: 'Listen', href: '/' },
  { id: 'talk', label: 'Talk', href: '/talk/' },
  { id: 'review', label: 'Review', href: '/review/' },
];

/** The space a path is in; null for pages outside the three (the guide). */
export function spaceForPath(pathname: string | null | undefined): NavSpace | null {
  const first = (pathname ?? '/').split('/').filter(Boolean)[0] ?? '';
  if (first === '') return 'listen';
  if (first === 'talk') return 'talk';
  if (first === 'review' || first === 'mistakes' || first === 'speaking') return 'review';
  return null;
}

export type ReviewTab = 'today' | 'mistakes' | 'speaking' | 'starred';
export const REVIEW_TABS: { id: ReviewTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'starred', label: 'Starred' },
];

/** Reads ?tab= from a query string; old links land on the right tab. */
export function reviewTabFromSearch(search: string): ReviewTab | null {
  const v = new URLSearchParams(search).get('tab');
  return REVIEW_TABS.find((t) => t.id === v)?.id ?? null;
}

// Screens that need the whole phone (a lesson, a talk) hide the bottom bar.
// A counter, so two screens mounted at once still work.
let focusCount = 0;
const listeners = new Set<() => void>();

export const navFocusStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get: () => focusCount > 0,
  getServer: () => false,
  /** Marks a full-screen view as open; call the returned function when it closes. */
  enter() {
    focusCount += 1;
    listeners.forEach((l) => l());
    let done = false;
    return () => {
      if (done) return;
      done = true;
      focusCount -= 1;
      listeners.forEach((l) => l());
    };
  },
};
