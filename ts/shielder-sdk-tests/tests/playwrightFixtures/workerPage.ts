import type { Browser, Page } from "@playwright/test";

export const workerPageFixture = async (
  { browser }: { browser: Browser },
  use: (page: Page) => Promise<void>
) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/index.html");
  page.on("console", (msg) => {
    console.log(msg);
  });

  await page.waitForFunction(() => window.initialized);

  await initWasmModule(page);
  await use(page);

  await context.close();
};

// Makes the WASM module ready for use in the context of the browser's main thread.
async function initWasmModule(page: Page): Promise<void> {
  await page.evaluate(async () => {
    return await window.wasmCryptoClient.cryptoClient;
  });
  console.log(`WASM module initialized.`);
}
