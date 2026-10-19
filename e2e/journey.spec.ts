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

test("sets logged without a connection sync after a reload; a finished workout reopens as its summary", async ({ page }) => {
  await registerAndOnboard(page, { zero: true });
  await page.getByRole("button", { name: /Start workout|Train anyway/ }).click();
  await expect(page).toHaveURL(/\/live\//);
  const liveUrl = page.url();
  const sessionId = liveUrl.split("/live/")[1];
  await page.getByRole("button", { name: "Warm-up done" }).click();

  // The connection drops just for set logging: the set is kept on the device.
  await page.route("**/api/sessions/*/sets", (route) => route.abort("internetdisconnected"));
  const startTimer = page.getByRole("button", { name: "Start timer" });
  if (await startTimer.isVisible()) {
    await startTimer.click();
    await page.waitForTimeout(1200);
  }
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.getByText(/Offline — 1 set\(s\) saved on this device/)).toBeVisible();

  // Back online and reloaded: the queued set is sent without any further action.
  await page.unroute("**/api/sessions/*/sets");
  await page.reload();
  await expect.poll(async () => (await (await page.request.get(`/api/sessions/${sessionId}`)).json()).session.sets.length).toBe(1);
  await expect(page.getByText(/Offline —/)).toHaveCount(0);

  const skipRest = page.getByRole("button", { name: "Skip rest" });
  if (await skipRest.isVisible()) await skipRest.click();
  await page.getByRole("button", { name: "Finish workout" }).last().click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();

  // Opening the finished workout again shows its summary, not the logging screen.
  await page.goto(liveUrl);
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log set" })).toHaveCount(0);
});

test("today shows a coach suggestion with its reasons, and 'Not today' leaves the plan alone", async ({ page }) => {
  await registerAndOnboard(page);
  await expect(page.getByText(/Coach suggestion:/)).toBeVisible();
  await expect(page.getByText("What we don't know")).toBeVisible(); // no check-in yet → readiness unknown
  await page.getByRole("button", { name: "Not today" }).click();
  await expect(page.getByText(/You dismissed today's coach suggestion/)).toBeVisible();
});

test("schedule a workout on the calendar, then reschedule it", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/plans#calendar");
  const schedule = page.getByRole("button", { name: /^Schedule a workout on / }).first();
  const label = (await schedule.getAttribute("aria-label"))!;
  const dateKey = label.replace("Schedule a workout on ", "");
  await schedule.click();
  const reschedule = page.getByRole("button", { name: new RegExp(`^Reschedule .* on ${dateKey}$`) });
  await expect(reschedule).toBeVisible();
  await reschedule.click();
  const [y, m, d] = dateKey.split("-").map(Number);
  const later = new Date(Date.UTC(y, m - 1, d + 2)).toISOString().slice(0, 10);
  await page.getByLabel("New date").fill(later);
  await page.getByRole("button", { name: "Move workout" }).click();
  await expect(page.getByText("Workout moved")).toBeVisible();
  // After a reload the move persisted: the original day offers "Schedule" again.
  await page.reload();
  await expect(page.getByRole("button", { name: `Schedule a workout on ${dateKey}` })).toBeVisible();
});

test("switch language to French and Arabic (right-to-left) from Settings", async ({ page }) => {
  await registerAndOnboard(page);
  const switchTo = async (value: string) => {
    await page.goto("/profile");
    await page.getByLabel("Language").selectOption(value);
    await page.locator("#prefs").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();
    await page.goto("/today");
  };
  await switchTo("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("link", { name: "Aujourd'hui" }).first()).toBeVisible();
  await switchTo("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("link", { name: "اليوم" }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await switchTo("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
