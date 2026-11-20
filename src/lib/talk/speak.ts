// noda - Talk: read a phrase out loud with the browser's own voices.
// Chirp 3 HD from Google is planned for the Talk step; this is the free fallback.

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

export function speak(text: string, rate = 1): void {
  if (!canSpeak() || !text.trim()) return;
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
