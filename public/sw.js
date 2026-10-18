/* APEX FIT service worker.
 * - Static build assets: cache-first (they are content-hashed).
 * - Pages: network-first; offline falls back to pages the user explicitly saved, then /offline.
 * - API requests are never cached (private, live data), and nothing but GET is intercepted.
 * - The page can ask to save/remove pages for offline use, or clear everything (on logout).
 */
const VERSION = "v1";
const STATIC = `apex-static-${VERSION}`;
const SAVED = "apex-saved"; // user-chosen lessons/plans; survives SW updates
const SHELL = `apex-shell-${VERSION}`;
const SHELL_URLS = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== SHELL && k !== SAVED).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live, private data: always network

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const saved = await caches.open(SAVED);
        const hit = (await saved.match(url.pathname + url.search)) || (await saved.match(url.pathname));
        return hit || (await caches.match("/offline")) || Response.error();
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  const reply = (data) => event.ports[0] && event.ports[0].postMessage(data);
  if (msg.type === "save" && typeof msg.url === "string" && msg.url.startsWith("/")) {
    event.waitUntil(
      fetch(msg.url, { credentials: "same-origin" })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          await (await caches.open(SAVED)).put(msg.url, res);
          reply({ ok: true });
        })
        .catch((e) => reply({ ok: false, error: String(e) })),
    );
  } else if (msg.type === "remove" && typeof msg.url === "string") {
    event.waitUntil(caches.open(SAVED).then((c) => c.delete(msg.url)).then(() => reply({ ok: true })));
  } else if (msg.type === "clear") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => reply({ ok: true })));
  }
});
