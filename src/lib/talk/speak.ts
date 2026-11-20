// noda - Talk: read a line out loud. Google's Chirp 3 HD voice first (talkSpeak);
// when it is not available, the browser's own voices for the rest of the visit.

type VoiceLike = { name: string; lang: string; localService?: boolean };

/** Best English voice: Edge's "Natural" voices first, then Google's, then any en-US, then any English. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  const us = en.filter((v) => /^en[-_]us$/i.test(v.lang));
  return (
    us.find((v) => /natural/i.test(v.name)) ??
    en.find((v) => /natural/i.test(v.name)) ??
    us.find((v) => /google/i.test(v.name)) ??
    us[0] ??
    en[0] ??
    null
  );
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Off in tests and E2E mode (no Firebase), and after the first failure. */
let chirpOff = process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_E2E_MODE === 'true';
let current: HTMLAudioElement | null = null;
let ticket = 0;

/** Stops any line being read (Chirp audio or the browser voice). */
export function stopSpeaking(): void {
  ticket++;
  current?.pause();
  current = null;
  if (canSpeak()) window.speechSynthesis.cancel();
}

export function speak(text: string, rate = 1): void {
  if (!text.trim() || typeof window === 'undefined') return;
  stopSpeaking();
  if (chirpOff) return speakBrowser(text, rate);
  const mine = ticket;
  import('./voice-remote')
    .then((m) => m.chirpAudio(text))
    .then(
      (url) => {
        if (mine !== ticket) return; // stopped, or a newer line started
        const a = new Audio(url);
        a.playbackRate = rate;
        current = a;
        // A blocked autoplay only skips this line; Chirp stays on.
        return a.play().catch(() => undefined);
      },
      () => {
        // The voice is not available (API off, offline): browser voice from now on.
        chirpOff = true;
        if (mine === ticket) speakBrowser(text, rate);
      },
    );
}

function speakBrowser(text: string, rate: number): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const voice = pickVoice(synth.getVoices());
  if (voice) u.voice = voice;
  synth.speak(u);
}

/** Voices load late in Chrome and Edge; ask once early so the first tap has them. */
export function warmUpVoices(): void {
  if (canSpeak()) window.speechSynthesis.getVoices();
}
