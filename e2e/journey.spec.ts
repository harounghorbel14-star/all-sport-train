import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/login/);
});

test("start from zero → today's plan → live workout → refresh → finish", async ({ page }) => {
  await registerAndOnboard(page, { zero: true });
  await expect(page.getByText("Your plan is ready.")).toBeVisible();
  await expect(page.getByText("Start-from-zero guide")).toBeVisible();

  const start = page.getByRole("button", { name: /Start workout|Train anyway/ });
  await start.click();
  await expect(page).toHaveURL(/\/live\//);

  // Warm-up then main work
  await page.getByRole("button", { name: "Warm-up done" }).click();
  const logSet = page.getByRole("button", { name: "Log set" });
  // Timed exercises need the timer; for reps we can log directly.
  const startTimer = page.getByRole("button", { name: "Start timer" });
  if (await startTimer.isVisible()) {
    await startTimer.click();
    await page.waitForTimeout(1200);
  }
  await logSet.click();
  await expect(page.getByLabel(/1 of \d+ sets done/)).toBeVisible();

  // Refresh: state comes back from the server
  await page.reload();
  await expect(page.getByLabel(/1 of \d+ sets done/)).toBeVisible();

  // Pause / resume
  const skipRest = page.getByRole("button", { name: "Skip rest" });
  if (await skipRest.isVisible()) await skipRest.click();
  await page.getByRole("button", { name: "Pause" }).first().click();
  await expect(page.getByText("Paused — timer stopped.")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).first().click();

  await page.getByRole("button", { name: "Finish workout" }).last().click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  await expect(page.getByText("First Workout")).toBeVisible();
  await expect(page.getByText(/kcal · estimate/)).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Done for today")).toBeVisible();
});

test("log a food and see the day total update", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add" }).first().click();
  await page.getByLabel("Search foods").fill("banana");
  await page.getByRole("button", { name: /^Banana/ }).click();
  await page.getByRole("button", { name: "Log food" }).click();
  await expect(page.getByText("Banana", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Calories logged vs goal")).toContainText("105");
});

test("rule-based coach answers with a workout action", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/coach");
  await expect(page.getByText("Rule-based mode")).toBeVisible();
  await page.getByRole("button", { name: "I only have 20 minutes" }).click();
  await expect(page.getByText(/open to edit or start/)).toBeVisible();
});
