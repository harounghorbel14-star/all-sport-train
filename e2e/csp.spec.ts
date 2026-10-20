import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("pages send a nonce-based Content-Security-Policy and nothing on them violates it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const res = await page.goto("/login");
  const csp = res!.headers()["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain("frame-ancestors 'none'");
  await registerAndOnboard(page);
  for (const path of ["/today", "/plans", "/progress", "/sports/basketball", "/coach", "/offline", "/form-check"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), path).toEqual([]);
  }
  // Scripts really run (the page hydrated): a client-side control responds.
  await page.goto("/today");
  await page.getByRole("button", { name: /Start workout|Train anyway/ }).click();
  await expect(page).toHaveURL(/\/live\//);
});
