import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

import { e2eDatabaseUrl } from "./src/test/database-url";

// The e2e database lives next to the working one: its address is made from DATABASE_URL.
config({ quiet: true });

const workingUrl = process.env.DATABASE_URL;
if (!workingUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// The tests put rows into the same database the e2e server works with: see e2e/fixtures.ts.
const e2eUrl = e2eDatabaseUrl(workingUrl);
process.env.E2E_DATABASE_URL = e2eUrl;

// Not 3000, where `pnpm dev` and `pnpm start` work with the working contacts.
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  // There is one database for all the tests: they run one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // The full Chromium in its headless mode, not the separate headless shell: one browser
      // to install (`playwright install chromium --no-shell`), and it is the real browser.
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
  webServer: {
    // The built app, as on the server, working with the e2e database only. The database is
    // prepared here and not in a global setup: Playwright starts the server first and waits for
    // `/health`, which answers 200 only when the app can reach its database.
    command: `pnpm exec tsx e2e/prepare-database.ts && pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/health`,
    env: { DATABASE_URL: e2eUrl },
    // Always the app built from the current code, never a server left from an older run.
    reuseExistingServer: false,
    timeout: 5 * 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
