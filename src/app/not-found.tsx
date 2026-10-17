import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="num text-8xl font-bold text-accent">404</p>
        <h1 className="num mt-2 text-3xl font-bold uppercase">Page not found</h1>
        <p className="mt-2 text-muted">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/today" className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-accent-fg">Back to today</Link>
      </div>
    </main>
  );
}
