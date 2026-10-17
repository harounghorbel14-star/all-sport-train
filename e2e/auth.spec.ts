import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("protected pages send visitors to login and back to where they were going", async ({ page }) => {
  const email = await registerAndOnboard(page);
  await page.context().clearCookies();
  await page.goto("/sports/tennis?tab=rules");
  await expect(page).toHaveURL(/\/login\?next=%2Fsports%2Ftennis/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/sports\/tennis\?tab=rules/);
});

test("registration validates on the client before submitting", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("What should we call you?").fill("Val");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("different");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  await expect(page.getByText("Passwords don't match")).toBeVisible();
  await expect(page.getByText("Please accept the terms and privacy policy")).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
  // Show/hide password
  const pw = page.getByLabel("Password", { exact: true });
  await expect(pw).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).first().click();
  await expect(pw).toHaveAttribute("type", "text");
});

test("wrong credentials show a clear error; an unconfigured Google button is hidden in production", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Continue with Google")).toHaveCount(0);
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrongpassword1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
});

test("forgot password never reveals whether an account exists", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill("nobody-at-all@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists for that email/)).toBeVisible();
  await page.goto("/reset-password?token=bogus-token-that-is-long-enough");
  await page.getByLabel("New password").fill("newpassword123");
  await page.getByLabel("Confirm password").fill("newpassword123");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();
});

test("guest: explore, hit a restricted feature, then save progress", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("Guest mode.")).toBeVisible();
  await page.goto("/exercises");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/community");
  await expect(page).toHaveURL(/\/account-required/);
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Save your progress" })).toBeVisible();
  await page.getByLabel("What should we call you?").fill("Ex Guest");
  await page.getByLabel("Email").fill(`guest${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("Guest mode.")).toHaveCount(0);
  await page.goto("/community");
  await expect(page).toHaveURL(/\/community/);
});
