"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
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
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-6"
      style={{ backgroundColor: "var(--background)" }}
    >
      <section className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <img
            src="/branding/noda-icon.svg"
            alt={`${appName} icon`}
            className="mx-auto h-10 w-10 rounded-xl p-1"
            style={{
              border: "1px solid color-mix(in srgb, var(--border), transparent 20%)",
              backgroundColor: "color-mix(in srgb, var(--muted), transparent 40%)",
            }}
          />
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
            {appName}
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {subtitle ?? "Private workspace. Continue with your Google account."}
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          disabled={loading}
          onClick={() => void onGoogleSignIn()}
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
