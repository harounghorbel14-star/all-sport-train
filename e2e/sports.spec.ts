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
  await expect(page.getByText("not yet verified against the current rulebook").first()).toBeVisible();

  await page.getByRole("tab", { name: "Learn" }).click();
  await expect(page).toHaveURL(/tab=learn/);
  await page.getByRole("link", { name: /Ball-handling basics/ }).first().click();
  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  // This lesson has a knowledge check, so marking it done isn't enough.
  await expect(page.getByText("Awaiting assessment")).toBeVisible();
  const quiz = page.locator("#quiz");
  await quiz.getByRole("button", { name: "Start the check" }).click();
  await quiz.getByRole("button", { name: "Submit answers" }).click(); // nothing answered: everything is wrong
  await expect(quiz.getByText(/^0 of \d+ correct/)).toBeVisible();
  // Learn from the review, then retry.
  const items = quiz.locator("ol > li");
  const answers: { prompt: string; correct: string[] }[] = [];
  for (let i = 0; i < (await items.count()); i++) {
    const prompt = (await items.nth(i).locator("p").first().innerText()).replace(/^\d+\.\s*/, "").trim();
    const correct = (await items.nth(i).getByText(/^Correct answer:/).innerText()).replace(/^Correct answer:\s*/, "").split("; ");
    answers.push({ prompt, correct });
  }
  await quiz.getByRole("button", { name: "Try again" }).click();
  for (const a of answers) {
    const set = quiz.locator("fieldset").filter({ hasText: a.prompt });
    for (const c of a.correct) await set.getByLabel(c, { exact: true }).check();
  }
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  await expect(quiz.getByText("Passed — this counts toward completing the lesson.")).toBeVisible();
  await expect(page.getByText("Completed · knowledge check passed")).toBeVisible();

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

test("query-string tabs always respond, even on chart-heavy pages", async ({ page }) => {
  await registerAndOnboard(page);
  for (const [start, tabs] of [["/sports/basketball?tab=drills", ["Rules", "Learn", "Drills", "Progress", "Overview"]], ["/progress?range=12w", ["4w", "24w", "12w"]]] as const) {
    await page.goto(start);
    for (let i = 0; i < 10; i++) {
      const tab = page.getByRole("tab", { name: tabs[i % tabs.length], exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 8000 });
    }
  }
});

test("record a result, then correct a typo — bests update and the original is kept", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/sports/basketball?tab=progress");
  await page.getByLabel("Metric").selectOption({ label: "Free throws" });
  await page.getByLabel("Made").fill("19"); // typo: meant 9
  await page.getByLabel("Attempts").fill("20");
  await page.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText("Best 95%")).toBeVisible();

  await page.getByRole("button", { name: /^Correct Free throws entry/ }).click();
  await page.getByLabel("Made").last().fill("9");
  await page.getByLabel("Reason (optional)").fill("typo");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Best 45%")).toBeVisible();
  await expect(page.getByText("Best 95%")).toHaveCount(0);
});
