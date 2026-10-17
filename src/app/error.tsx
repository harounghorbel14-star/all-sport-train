"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <h1 className="num text-4xl font-bold uppercase">Something went wrong</h1>
        <p className="mt-2 text-muted">Your data is safe. Please try again.</p>
        {error.digest && <p className="mt-1 text-xs text-subtle">Reference: {error.digest}</p>}
        <button onClick={reset} className="mt-6 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-fg">Try again</button>
      </div>
    </main>
  );
}
