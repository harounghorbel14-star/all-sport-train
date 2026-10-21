import { expect, test, type Page } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

/** Lightweight accessibility checks (no extra dependency): names, labels, landmarks, ids, overflow, focus. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const name = (el: Element) => {
      const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title");
      if (aria && aria.trim()) return aria.trim();
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        if (el.labels && el.labels.length && [...el.labels].some((l) => l.textContent?.trim())) return "label";
        if (el instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(el.type)) return el.value || "ok";
        return "";
      }
      return (el.textContent ?? "").trim() || [...el.querySelectorAll("img[alt],svg[aria-label]")].map((i) => i.getAttribute("alt") || i.getAttribute("aria-label")).join("");
    };
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    if (!document.documentElement.lang) problems.push("html lang missing");
    const h1 = [...document.querySelectorAll("h1")].filter(visible);
    if (h1.length !== 1) problems.push(`expected one visible h1, found ${h1.length}`);
    if (!document.querySelector("main")) problems.push("no <main> landmark");
    for (const el of document.querySelectorAll("button, a[href], [role=button], [role=tab]")) if (visible(el) && !name(el)) problems.push(`unnamed ${el.tagName.toLowerCase()}: ${el.outerHTML.slice(0, 120)}`);
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if ((el as HTMLInputElement).type === "hidden" || !visible(el)) continue;
      if (!name(el)) problems.push(`unlabelled control: ${el.outerHTML.slice(0, 120)}`);
    }
    for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) problems.push(`img without alt: ${img.outerHTML.slice(0, 100)}`);
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) problems.push(`duplicate ids: ${[...new Set(dup)].join(", ")}`);
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) problems.push(`horizontal overflow ${document.documentElement.scrollWidth - document.documentElement.clientWidth}px`);
    return problems;
  });
}

const PAGES = ["/today", "/plans", "/progress", "/activity", "/nutrition", "/recovery", "/sports", "/sports/basketball", "/sports/basketball/lessons/ball-handling", "/academy", "/exercises", "/coach", "/profile", "/profile/privacy", "/offline"];

test("core pages pass basic accessibility checks", async ({ page }) => {
  test.setTimeout(240_000);
  await registerAndOnboard(page);
  const all: string[] = [];
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const p of await audit(page)) all.push(`${path}: ${p}`);
  }
  expect(all, all.join("\n")).toEqual([]);
});

test("keyboard focus is visible", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "none";
    const st = getComputedStyle(el);
    return `${st.outlineStyle} ${st.outlineWidth} ${st.boxShadow}`;
  });
  expect(outline).not.toMatch(/^none 0px none$/);
});
