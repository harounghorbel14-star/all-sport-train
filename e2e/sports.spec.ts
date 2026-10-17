import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("sports: search → join → lesson → practice → log a result", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/sports");
  await page.getByLabel("Search sports").fill("hoops");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: /Basketball/ }).first().click();
  await expect(page.getByRole("heading", { name: "Basketball", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add sport" }).click();
  await expect(page.getByText("In my sports")).toBeVisible();

  await page.getByRole("tab", { name: "Rules" }).click();
  await expect(page).toHaveURL(/tab=rules/);
  await expect(page.getByText("Summary checked against source").first()).toBeVisible();

  await page.getByRole("tab", { name: "Learn" }).click();
  await expect(page).toHaveURL(/tab=learn/);
  await page.getByRole("link", { name: /Ball-handling basics/ }).first().click();
  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await expect(page).not.toHaveURL(/ball-handling/);

  await page.goto("/sports/basketball?tab=practice");
  await page.getByRole("button", { name: "Build practice" }).click();
  await expect(page).toHaveURL(/\/practice\//);
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  await page.getByRole("button", { name: /Complete & log/ }).click();
  await expect(page).toHaveURL(/tab=progress/);

  await page.getByLabel("Metric").selectOption({ label: "Free throws" });
  await page.getByLabel("Made").fill("14");
  await page.getByLabel("Attempts").fill("20");
  await page.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText("Best 70%")).toBeVisible();
});
