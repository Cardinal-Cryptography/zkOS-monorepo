import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.base.config.mjs';

export default defineConfig({
    ...baseConfig,
    webServer: {
        ...baseConfig.webServer,
        command: 'PLASMO_PUBLIC_THREADS=max PLASMO_PUBLIC_STORAGE_MODE=webapp pnpm vite',
    },
});