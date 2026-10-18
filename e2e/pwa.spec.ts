import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("installable: manifest, icons and service worker are served", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBe(true);
  const manifest = await m.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { sizes: string; purpose?: string }) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("download buttons explain how to install on iPhone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Download for iPhone and iPad" }).click();
  await expect(page.getByRole("dialog")).toContainText("Add to Home Screen");
});

// Note: Playwright's offline mode doesn't apply to requests made by the service worker itself, so
// the offline fallback logic is unit-tested in tests/sw.test.ts; here we verify the real caches.
test("saving a lesson stores it in the offline cache; logout clears it", async ({ page }) => {
  await registerAndOnboard(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/sports/tennis?tab=learn");
  await page.locator('a[href^="/sports/tennis/lessons/"]').first().click();
  await page.waitForURL(/lessons/);
  const lessonUrl = new URL(page.url()).pathname;
  const title = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  await page.getByRole("button", { name: "Save for offline" }).click();
  await expect(page.getByRole("button", { name: /Saved offline/ })).toBeVisible();

  const cached = await page.evaluate(async (url) => {
    const res = await (await caches.open("apex-saved")).match(url);
    return res ? await res.text() : null;
  }, lessonUrl);
  expect(cached).toContain(title.replace(/&/g, "&amp;"));
  const shellHasOffline = await page.evaluate(async () => Boolean(await caches.match("/offline")));
  expect(shellHasOffline).toBe(true);

  await page.goto("/offline");
  await expect(page.getByRole("link", { name: new RegExp(title.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();

  await page.goto("/today");
  await page.getByRole("button", { name: /Log out/i }).first().click();
  await expect(page).toHaveURL(/login/);
  // Personal saved pages and their index are gone (shared static JS chunks may be re-cached by the login page).
  const left = await page.evaluate(async () => ({ saved: (await (await caches.open("apex-saved")).keys()).length, index: localStorage.getItem("apex:offline-index") }));
  expect(left).toEqual({ saved: 0, index: null });
});
