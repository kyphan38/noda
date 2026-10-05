"use client";

import { useState } from "react";
import Image from "next/image";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/auth/firebase-client";

type LoginViewProps = {
  appName: string;
  subtitle?: string;
};

export function LoginView({ appName, subtitle }: LoginViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getFirebaseAuth(), provider);
    } catch (err) {
      const code =
        err !== null && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      if (code === "auth/unauthorized-domain" && host) {
        setError(
          `This host is not allowed for Firebase Auth (${host}). In Firebase Console → Authentication → Settings → Authorized domains, add your production host (e.g. ${host}) and redeploy if needed.`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
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
