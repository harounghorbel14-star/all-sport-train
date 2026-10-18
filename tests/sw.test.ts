import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Runs public/sw.js against an in-memory Cache API and a controllable network. */
function loadWorker(network: (url: string) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, "https://app.test").pathname + new URL(typeof r === "string" ? r : r.url, "https://app.test").search;
    return {
      match: async (r: Request | string) => m.get(key(r))?.clone(),
      put: async (r: Request | string, res: Response) => void m.set(key(r), res),
      delete: async (r: Request | string) => m.delete(key(r)),
      addAll: async (urls: string[]) => {
        for (const u of urls) m.set(key(u), new Response(`cached ${u}`));
      },
      keys: async () => [...m.keys()],
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (r: Request | string) => {
      for (const n of stores.keys()) {
        const hit = await (await open(n)).match(r);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = { location: { origin: "https://app.test" }, addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn), skipWaiting: () => undefined, clients: { claim: () => undefined } };
  const fn = new Function("self", "caches", "fetch", "Response", "URL", readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8"));
  fn(self, caches, (r: Request | string) => network(typeof r === "string" ? r : r.url), Response, URL);
  const run = async (type: string, event: Record<string, unknown>) => {
    let pending: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    listeners[type]({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p), respondWith: (p: Promise<Response>) => (responded = p) });
    await pending;
    return responded ? await responded : undefined;
  };
  const navigate = (url: string) => run("fetch", { request: { method: "GET", mode: "navigate", url: `https://app.test${url}` } });
  return { stores, run, navigate, open };
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

describe("service worker", () => {
  it("serves saved pages offline and falls back to /offline for everything else", async () => {
    const w = loadWorker(offline);
    await w.run("install", {});
    await (await w.open("apex-saved")).put("/sports/tennis/lessons/grips", new Response("<h1>Grips</h1>"));
    expect(await (await w.navigate("/sports/tennis/lessons/grips"))!.text()).toBe("<h1>Grips</h1>");
    expect(await (await w.navigate("/progress"))!.text()).toBe("cached /offline");
  });

  it("uses the network first when online, and never intercepts API calls or non-GET requests", async () => {
    const w = loadWorker(async (u) => new Response(`live ${new URL(u).pathname}`));
    await (await w.open("apex-saved")).put("/today", new Response("stale"));
    expect(await (await w.navigate("/today"))!.text()).toBe("live /today");
    expect(await w.run("fetch", { request: { method: "GET", mode: "cors", url: "https://app.test/api/profile" } })).toBeUndefined();
    expect(await w.run("fetch", { request: { method: "POST", mode: "cors", url: "https://app.test/today" } })).toBeUndefined();
  });

  it("caches static build assets and clears everything on request", async () => {
    let calls = 0;
    const w = loadWorker(async () => {
      calls++;
      return new Response("chunk");
    });
    const req = { method: "GET", mode: "no-cors", url: "https://app.test/_next/static/chunks/a.js" };
    await w.run("fetch", { request: req });
    await new Promise((r) => setTimeout(r, 0));
    await w.run("fetch", { request: req });
    expect(calls).toBe(1);
    const port = { postMessage: () => undefined };
    await w.run("message", { data: { type: "clear" }, ports: [port] });
    expect(w.stores.size).toBe(0);
  });
});
