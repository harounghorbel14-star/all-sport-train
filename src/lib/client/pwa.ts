"use client";

/** Client helpers for the installable app (PWA): service worker, offline saves, install detection. */

export interface SavedItem {
  url: string;
  title: string;
  kind: "lesson" | "plan" | "sport" | "practice";
  savedAt: string;
}

const INDEX_KEY = "apex:offline-index"; // titles/urls only — never tokens or personal data

export const swSupported = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof caches !== "undefined";

export function readIndex(): SavedItem[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as SavedItem[];
  } catch {
    return [];
  }
}
function writeIndex(items: SavedItem[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* storage unavailable: offline list just won't show titles */
  }
}

async function postToWorker<T>(message: Record<string, unknown>): Promise<T> {
  const reg = await navigator.serviceWorker.ready;
  const worker = reg.active;
  if (!worker) throw new Error("Offline support isn't ready yet — reload the page and try again.");
  return new Promise<T>((resolve, reject) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Saving timed out")), 20_000);
    ch.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data as T);
    };
    worker.postMessage(message, [ch.port2]);
  });
}

export async function saveForOffline(item: Omit<SavedItem, "savedAt">) {
  if (!swSupported()) throw new Error("This browser doesn't support offline saving.");
  const r = await postToWorker<{ ok: boolean; error?: string }>({ type: "save", url: item.url });
  if (!r.ok) throw new Error("Couldn't save this page for offline use.");
  writeIndex([{ ...item, savedAt: new Date().toISOString() }, ...readIndex().filter((x) => x.url !== item.url)]);
}

export async function removeOffline(url: string) {
  if (swSupported()) await postToWorker({ type: "remove", url }).catch(() => undefined);
  writeIndex(readIndex().filter((x) => x.url !== url));
}

export async function isSaved(url: string) {
  if (!swSupported()) return false;
  const cache = await caches.open("apex-saved");
  return Boolean(await cache.match(url));
}

/** Removes every cached page and the offline index (called on logout and account deletion). */
export async function clearOfflineData() {
  try {
    localStorage.removeItem(INDEX_KEY);
  } catch {
    /* ignore */
  }
  if (!swSupported()) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

export type InstallPlatform = "ios" | "android" | "desktop";
export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS reports as Mac; touch points tell them apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
