"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/auth/firebase-client";

/** iPhone, iPad (iPadOS says "Macintosh") or the home-screen app. */
function prefersRedirect(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || standalone;
}

function errorCode(err: unknown): string {
  return err !== null && typeof err === "object" && "code" in err
    ? String((err as { code: unknown }).code)
    : "";
}

function signInMessage(err: unknown): string {
  const code = errorCode(err);
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The sign-in window closed. Please try again.";
    case "auth/network-request-failed":
      return "No network connection. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return `This host is not allowed for Firebase Auth (${host}). In Firebase Console → Authentication → Settings → Authorized domains, add your production host (e.g. ${host}) and redeploy if needed.`;
    default:
      return err instanceof Error ? err.message : "Sign-in failed.";
  }
}

type LoginViewProps = {
  appName: string;
  subtitle?: string;
};

export function LoginView({ appName, subtitle }: LoginViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from a redirect sign-in: success goes through onAuthStateChanged in
  // app/page.tsx, only errors need showing here.
  useEffect(() => {
    getRedirectResult(getFirebaseAuth()).catch((err) => {
      console.warn("[auth] redirect result failed", err);
      setError(signInMessage(err));
    });
  }, []);

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // Redirect only works when the auth handler is on this same domain
    // (see vercel.json); otherwise Safari loses the result.
    const sameDomainHandler = auth.config.authDomain === window.location.host;
    try {
      if (sameDomainHandler && prefersRedirect()) {
        await signInWithRedirect(auth, provider);
        return; // the page navigates away
      }
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (sameDomainHandler && errorCode(err) === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setError(signInMessage(redirectErr));
        }
      } else {
        setError(signInMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Same login screen as every ws/app app (after hodi): icon, name, one short
  // line, one outlined "Continue with Google" button. No Google logo.
  // gray-100 is ink and gray-800 the hairline in both themes (globals.css).
  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col items-center justify-center gap-8 px-5 pb-[12dvh] text-center"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <Image src="/branding/noda-icon.svg" alt="" width={40} height={40} />
        <div>
          <h1 className="text-xl font-medium tracking-tight text-gray-100">{appName}</h1>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void onGoogleSignIn()}
        disabled={loading}
        className="w-full max-w-xs rounded-full border border-gray-800 px-4 py-3 text-sm text-gray-100 transition-colors hover:bg-gray-100/[0.06] disabled:opacity-40"
      >
        {loading ? "Signing in…" : "Continue with Google"}
      </button>

      {error ? (
        <p role="alert" className="max-w-xs text-sm text-gray-400">
          {error}
        </p>
      ) : null}
    </main>
  );
}
