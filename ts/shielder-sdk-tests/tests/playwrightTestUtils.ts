// Utils to be used in our Node.js Playwright testing code.

import { test, type Page } from "@playwright/test";

export const sdkTest = test.extend<
  object,
  {
    workerPage: Page;
  }
>({
  // Hide the test-scoped `Page`.
  page: undefined,

  // One `Page` is shared between all tests that are run in the same Playwright worker. This is
  // done to save time on WASM initialization. Within worker, tests are run sequentially, so there
  // are no thread-safety concerns here.
  workerPage: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("/index.html");
      page.on("console", (msg) => {
        console.log(msg);
      });

      await initWasmModule(page);
      await use(page);

      await context.close();
    },
    { scope: "worker" }
  ]
});

// Makes the WASM module ready for use in the context of the browser's main thread.
async function initWasmModule(page: Page): Promise<void> {
  const threads = await page.evaluate(async () => {
    return await window.wasmCryptoClient.cryptoClient;
  });
  console.log(`WASM module initialized with ${threads} thread(s).`);
}

// Handles a `Uint8Array` returned from `page.evaluate`. Probably due to the way Playwright handles
// serialization, when the function executed inside `page.evaluate` returns a `Uint8Array`, the
// return type of `page.evaluate` is `Uint8Array` during `pnpm build`
// but `{ [key: string]: number }` at runtime.
export function unpackUint8Array(
  obj: Uint8Array | { [key: string]: number }
): Uint8Array {
  if (obj instanceof Uint8Array) {
    return obj;
  } else {
    return Uint8Array.from(Object.values(obj));
  }
}
