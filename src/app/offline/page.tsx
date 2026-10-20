import { OfflineList } from "./list";

export const metadata = { title: "Offline" };
// Rendered per request so its scripts carry the CSP nonce; the service worker caches the whole
// response (nonce and matching header together) at install time.
export const dynamic = "force-dynamic";

export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">APEX FIT</p>
      <h1 className="num mt-2 text-5xl font-bold uppercase">Offline</h1>
      <OfflineList />
    </main>
  );
}
