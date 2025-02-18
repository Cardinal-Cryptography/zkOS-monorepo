import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.base.config.mjs";

export default defineConfig({
  ...baseConfig,
  webServer: {
    ...baseConfig.webServer,
    command: "VITE_PUBLIC_THREADS=1 PLASMO_PUBLIC_STORAGE_MODE=webapp pnpm vite"
  }
});
