// noda - Talk: how to listen to a short answer, and what to say when it fails. Pure.

export type ListenEngine = 'browser' | 'gemini';

/** iPhone and iPad, including iPad asking for the desktop site. */
export function isAppleTouch(ua: string, platform: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/**
 * The browser's own speech (free) on Mac, Windows and Android; Gemini on iPhone,
 * where Safari often blocks it (above all as a home-screen app), and anywhere it failed.
 */
export function pickEngine(o: { hasWebSpeech: boolean; appleTouch: boolean; browserFailed: boolean }): ListenEngine {
  return o.hasWebSpeech && !o.appleTouch && !o.browserFailed ? 'browser' : 'gemini';
}

/** Browser errors that mean "this browser cannot do speech here": switch to Gemini. */
export const BROWSER_DEAD = new Set(['service-not-allowed', 'network', 'language-not-supported']);

/** A plain reason for a browser speech error, so a failure never just says "nothing". */
export function speechErrorReason(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'The microphone is blocked. Allow it for this site in your browser settings.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'no-speech':
      return 'No speech heard. Speak a little louder or closer to the mic.';
    case 'service-not-allowed':
    case 'network':
    case 'language-not-supported':
      return 'Speech is not available in this browser. Switched to Gemini: tap the mic again.';
    case 'aborted':
      return 'Stopped.';
    default:
      return 'Could not hear you. Try again or type it.';
  }
}
