import { expect, test } from "@playwright/test";

/**
 * The production report: Intermediate · Full Body · all seven goals · 6 sessions × 75 min · a mix ·
 * box/stairs + pull-up bar — and a height typed in centimetres before switching units.
 */
test("step 9 → Generate my plan works for the reported configuration, with height entered safely", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("What should we call you?").fill("Lina");
  await page.getByLabel("Email").fill(`onb${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/onboarding/);
  const next = () => page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: /^Intermediate/ }).click();
  await next();
  for (const g of ["Calisthenics skills", "Build muscle", "Get stronger", "Sport conditioning", "Better posture", "Flexibility & mobility"]) await page.getByRole("button", { name: g, exact: true }).click();
  await next();
  await page.getByRole("button", { name: /^Full Body/ }).click();
  await next();
  await next(); // sports
  await page.getByRole("button", { name: "A mix", exact: true }).click();
  await page.getByRole("button", { name: "Box or stairs", exact: true }).click();
  await page.getByRole("button", { name: "Pull-up bar", exact: true }).click();
  await next();
  const days = page.locator("#days");
  await days.focus();
  for (let i = 0; i < 3; i++) await days.press("ArrowRight");
  await expect(page.getByText("Training days per week: 6")).toBeVisible();
  await page.getByRole("button", { name: "75 min", exact: true }).click();
  await next();

  // About you — the failing case: 180 typed as cm, then units switched. It's converted, not reinterpreted.
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByRole("button", { name: /^Imperial/ }).click();
  await expect(page.getByLabel("Height, feet")).toHaveValue("5");
  await expect(page.getByLabel("Height, inches")).toHaveValue("11");
  await page.getByRole("button", { name: /^Metric/ }).click();
  // A digit typo is caught here, with the allowed range, before anything is sent.
  await page.getByLabel("Height (cm)").fill("1785");
  await expect(page.getByText("Height must be 100–250 cm.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  // A decimal comma is kept as a decimal.
  await page.getByLabel("Height (cm)").fill("178,5");
  await expect(page.getByLabel("Height (cm)")).toHaveValue("178.5");
  await page.getByLabel("Weight (kg)").fill("72,5");
  await next();
  await next(); // preferences

  // Review (step 9)
  await expect(page.getByText("Intermediate", { exact: true })).toBeVisible();
  await expect(page.getByText("Full Body", { exact: true })).toBeVisible();
  await expect(page.getByText("6× per week · 75 min")).toBeVisible();
  await expect(page.getByText("A mix", { exact: true })).toBeVisible();
  await expect(page.getByText("Box or stairs, Pull-up bar")).toBeVisible();
  await expect(page.getByText("178.5 cm · 72.5 kg")).toBeVisible();
  await page.getByRole("button", { name: "Generate my plan" }).click();

  await expect(page).toHaveURL(/today/);
  await expect(page.getByText("Your plan is ready.")).toBeVisible();
  await expect(page.getByText(/Week 1\s*\/ 24/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/~\d+ min · \d+ exercises/).first()).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("Starting point").first()).toBeVisible();
});
