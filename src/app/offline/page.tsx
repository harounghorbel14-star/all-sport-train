import { OfflineList } from "./list";

export const metadata = { title: "Offline" };
// Static so the service worker can cache it at install time.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">APEX FIT</p>
      <h1 className="num mt-2 text-5xl font-bold uppercase">Offline</h1>
      <OfflineList />
    </main>
  );
}
