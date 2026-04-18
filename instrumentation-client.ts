try {
  if (typeof window !== "undefined") {
    window.addEventListener(
      "unhandledrejection",
      (e: PromiseRejectionEvent) => {
        const err = e.reason as { name?: string } | undefined;
        if (err?.name === "AbortError") e.preventDefault();
      },
      { capture: true },
    );
  }
} catch {
  // never break bootstrap
}
