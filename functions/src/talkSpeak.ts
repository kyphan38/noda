/**
 * Talk voice: reads a line with Google's Chirp 3 HD voice. Each text is made
 * once and kept in Storage (users/{uid}/talkTts/), so a repeat costs nothing.
 * Needs the Cloud Text-to-Speech API on in the project (see MANUAL-talk.md);
 * until then it fails and the app uses the browser's voice.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { checkSpeakText, ttsBody, ttsKey } from "./lib/talkSpeak";

const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TOKEN_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

/** The function's own service account token, from the metadata server. */
async function accessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, { headers: { "Metadata-Flavor": "Google" } });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export const talkSpeak = onCall(
  { region: "asia-southeast1", secrets: ["ALLOWED_USER_UID"], timeoutSeconds: 30 },
  async (request): Promise<{ audio: string }> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
    const allowedUid = process.env.ALLOWED_USER_UID?.trim();
    if (!allowedUid || request.auth.uid !== allowedUid) throw new HttpsError("permission-denied", "This tool is single-user only.");
    let text: string;
    try {
      text = checkSpeakText(request.data);
    } catch {
      throw new HttpsError("invalid-argument", "Bad text.");
    }
    const file = getStorage().bucket().file(`users/${request.auth.uid}/talkTts/${ttsKey(text)}.mp3`);
    const [cached] = await file.exists();
    if (cached) return { audio: (await file.download())[0].toString("base64") };

    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(ttsBody(text)),
    });
    if (!res.ok) {
      // 403 SERVICE_DISABLED until the API is turned on: the app falls back.
      console.warn("[talkSpeak] TTS failed", res.status);
      throw new HttpsError("failed-precondition", "Voice is not available.");
    }
    const audio = ((await res.json()) as { audioContent?: string }).audioContent ?? "";
    if (!audio) throw new HttpsError("internal", "No audio.");
    await file.save(Buffer.from(audio, "base64"), { contentType: "audio/mpeg" });
    return { audio };
  }
);
