import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(responsive|auth|a11y)\.spec\.ts/ },
  ],
  webServer: {
    // Fresh, migrated and seeded database for every run (the server must not hold the file while it is recreated).
    command: `node -e "require('fs').rmSync('prisma/e2e.db',{force:true})" && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: "file:./e2e.db", SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456", UPLOAD_DIR: "./storage/e2e-uploads", ANTHROPIC_API_KEY: "", RATE_LIMIT_MULTIPLIER: "20", APP_BASE_URL: `http://localhost:${PORT}` },
  },
});
