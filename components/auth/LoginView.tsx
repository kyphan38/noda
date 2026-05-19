"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-6"
      style={{ backgroundColor: "var(--background)" }}
    >
      <section className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <Image
            src="/branding/noda-icon.svg"
            alt={`${appName} icon`}
            width={40}
            height={40}
            className="mx-auto rounded-xl p-1"
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

        <Button
          type="button"
          variant="default"
          className="h-11 w-full text-sm font-semibold"
          disabled={loading}
          onClick={() => void onGoogleSignIn()}
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </Button>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
