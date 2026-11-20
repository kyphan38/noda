/**
 * Talk voice: the pure parts of `talkSpeak` (Google Cloud Text-to-Speech,
 * Chirp 3 HD). No firebase-admin import, so the app's vitest suite can load it.
 */
import { createHash } from "crypto";

export const TTS_VOICE = "en-US-Chirp3-HD-Charon";
export const MAX_TTS_CHARS = 600;

export function checkSpeakText(data: unknown): string {
  const raw = (data as { text?: unknown } | null)?.text;
  const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!text || text.length > MAX_TTS_CHARS) throw new Error("Bad text.");
  return text;
}

/** Cache file name: the same text and voice are made once. */
export function ttsKey(text: string, voice = TTS_VOICE): string {
  return createHash("sha256").update(`${voice}|${text}`).digest("hex").slice(0, 32);
}

export function ttsBody(text: string, voice = TTS_VOICE) {
  return {
    input: { text },
    voice: { languageCode: voice.slice(0, 5), name: voice },
    audioConfig: { audioEncoding: "MP3" },
  };
}
