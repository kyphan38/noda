// "Auto-analyze" toggle in the shadowing panel, stored per device in localStorage.
// Off by default: every auto-analyzed sentence is a paid Gemini call.

const AUTO_ANALYZE_KEY = 'noda.shadowingAutoAnalyze';

export function readAutoAnalyze(): boolean {
  try {
    return localStorage.getItem(AUTO_ANALYZE_KEY) === '1';
  } catch {
    // Safari private mode blocks localStorage.
    return false;
  }
}

export function writeAutoAnalyze(on: boolean): void {
  try {
    if (on) localStorage.setItem(AUTO_ANALYZE_KEY, '1');
    else localStorage.removeItem(AUTO_ANALYZE_KEY);
  } catch {
    // Not saved; the toggle still works for this visit.
  }
}
