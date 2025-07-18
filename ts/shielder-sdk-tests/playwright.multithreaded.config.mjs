import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.base.config.mjs";

export default defineConfig({
  ...baseConfig,
  webServer: {
    ...baseConfig.webServer,
    command:
      "VITE_CRYPTO_CLIENT_TYPE=${CRYPTO_CLIENT_TYPE} VITE_PROVER_SERVER_URL=${PROVER_SERVER_URL} VITE_CHECK_NITRO_ATTESTATION=${CHECK_NITRO_ATTESTATION} VITE_PUBLIC_THREADS=max pnpm vite"
  }
});
