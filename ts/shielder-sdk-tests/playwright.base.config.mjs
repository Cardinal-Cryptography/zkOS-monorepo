import { defineConfig, devices } from "@playwright/test";

const url = `http://localhost:5173/`;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  // Run tests in parallel using workers. Within 1 worker, tests are still run sequentially.
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
    // Not including webkit (Safari) because WASM doesn't seem to work with it.
  ],
  reporter: process.env.CI ? "blob" : "list",
  retries: process.env.CI ? 2 : 0,
  testMatch: ["tests/**/*.test.ts"],
  timeout: 240 * 1000, // 240 seconds
  use: {
    baseURL: url
  },
  webServer: {
    url,
    reuseExistingServer: false
  },
  workers: 1
});
