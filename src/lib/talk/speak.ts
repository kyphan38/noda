// noda - Talk: read a line out loud, the same way every time.
// - Chirp 3 HD (talkSpeak) when it is known to work; whether it works is kept
//   on this device, so a turned-off API never slows a tap. Tried again daily.
// - Otherwise the browser voice, always the same one, started inside the tap
//   (iPhone only plays sound that starts from a tap).

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

export type ChirpState = { ok: boolean; at: number } | null;
const DAY = 86_400_000;

/** Try Chirp when it worked before, was never tried, or failed over a day ago. */
export function shouldTryChirp(s: ChirpState, now: number): boolean {
  return !s || s.ok || now - s.at > DAY;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

const CHIRP_KEY = 'noda.talk.chirp';
/** No Firebase in tests and E2E mode. */
const NO_CHIRP = process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_E2E_MODE === 'true';
/** An empty WAV: played once inside a tap, it lets iPhone play this element later. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

let player: HTMLAudioElement | null = null;
let unlocked = false;
let ticket = 0;
let voice: SpeechSynthesisVoice | null = null;

function readChirp(): ChirpState {
  try {
    return JSON.parse(localStorage.getItem(CHIRP_KEY) ?? 'null') as ChirpState;
  } catch {
    return null;
  }
}
function writeChirp(ok: boolean): void {
  try {
    localStorage.setItem(CHIRP_KEY, JSON.stringify({ ok, at: Date.now() }));
  } catch {
    // Kept for this visit only.
  }
}

function getPlayer(): HTMLAudioElement {
  if (!player) player = new Audio();
  return player;
}

/** Call inside a tap: after this, iPhone lets the app play audio without a new tap. */
export function unlockAudio(): void {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  const p = getPlayer();
  p.src = SILENT_WAV;
  // Some browsers return no promise from play(); never let that break a tap.
  try {
    void p.play()?.catch(() => {
      unlocked = false;
    });
  } catch {
    unlocked = false;
  }
}

/** Stops any line being read (Chirp audio or the browser voice). Also unlocks audio when called from a tap. */
export function stopSpeaking(): void {
  ticket++;
  unlockAudio();
  player?.pause();
  if (canSpeak() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
}

function playUrl(url: string, rate: number): void {
  const p = getPlayer();
  p.src = url;
  p.playbackRate = rate;
  try {
    void p.play()?.catch(() => undefined);
  } catch {
    // A blocked play only skips this line.
  }
}

export function speak(text: string, rate = 1): void {
  if (!text.trim() || typeof window === 'undefined') return;
  stopSpeaking();
  const mine = ticket;
  const state = NO_CHIRP ? { ok: false, at: Date.now() } : readChirp();

  if (state?.ok) {
    // Known to work: Chirp only. A failure falls back for this line.
    void import('./voice-remote').then((m) => {
      const hit = m.cachedChirp(text);
      if (hit) return mine === ticket && playUrl(hit, rate);
      return m.chirpAudio(text).then(
        (url) => mine === ticket && playUrl(url, rate),
        () => {
          writeChirp(false);
          if (mine === ticket) speakBrowser(text, rate);
        },
      );
    });
    return;
  }

  // Not known to work: the browser voice now, inside the tap, and (at most once a
  // day) a quiet check whether Chirp works, for next time.
  speakBrowser(text, rate);
  if (!NO_CHIRP && shouldTryChirp(state, Date.now())) {
    void import('./voice-remote')
      .then((m) => m.chirpAudio(text))
      .then(
        () => writeChirp(true),
        () => writeChirp(false),
      );
  }
}

function speakBrowser(text: string, rate: number): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const v = voice ?? pickVoice(synth.getVoices());
  if (v) u.voice = v;
  // Chrome sometimes drops a line spoken right after cancel(): wait a moment then.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(() => synth.speak(u), 60);
  } else synth.speak(u);
}

/** Voices load late in Chrome and Edge: keep one voice once they arrive, so every line sounds the same. */
export function warmUpVoices(): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  const pick = () => {
    voice = voice ?? pickVoice(synth.getVoices());
  };
  pick();
  synth.addEventListener?.('voiceschanged', pick, { once: true });
}
