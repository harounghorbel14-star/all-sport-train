import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← APEX FIT
      </Link>
      <h1 className="num mt-4 text-5xl font-bold uppercase">{title}</h1>
      <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
        Draft for development. This text describes how the app actually handles data, but it has not been reviewed by a lawyer and must be replaced with reviewed terms before a public launch.
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg">{children}</div>
    </main>
  );
}
