import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("navigation adapts to the viewport", async ({ page, isMobile }) => {
  await registerAndOnboard(page);
  if (isMobile) {
    const bottom = page.getByRole("navigation", { name: "Primary" });
    await expect(bottom).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await bottom.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Academy" }).click();
    await expect(page).toHaveURL(/academy/);
  } else {
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Exercises" }).click();
    await expect(page).toHaveURL(/exercises/);
  }
});
