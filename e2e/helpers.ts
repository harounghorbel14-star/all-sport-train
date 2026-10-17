import { expect, type Page } from "@playwright/test";

export async function registerAndOnboard(page: Page, opts: { zero?: boolean } = {}) {
  const email = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("What should we call you?").fill("Sam");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/onboarding/);
  if (opts.zero) await page.getByRole("button", { name: /Start from zero/ }).click();
  // Walk through the wizard with defaults
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Generate my plan" }).click();
  await expect(page).toHaveURL(/today/);
  return email;
}
