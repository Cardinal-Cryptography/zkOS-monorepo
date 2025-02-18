// Utils to be used in our Node.js Playwright testing code.

import { test, type Page } from "@playwright/test";
import {
  GlobalConfigFixture,
  globalConfigFixture
} from "./playwrightFixtures/globalConfig";
import {
  perTestConfigFixture,
  PerTestConfigFixture
} from "./playwrightFixtures/perTestConfig";
import { workerPageFixture } from "./playwrightFixtures/workerPage";

export const sdkTest = test.extend<
  {
    perTestConfigFixture: PerTestConfigFixture;
  },
  {
    globalConfigFixture: GlobalConfigFixture;
    workerPage: Page;
  }
>({
  // Hide the test-scoped `Page`.
  page: undefined,

  // One `Page` is shared between all tests that are run in the same Playwright worker. This is
  // done to save time on WASM initialization. Within worker, tests are run sequentially, so there
  // are no thread-safety concerns here.
  workerPage: [workerPageFixture, { scope: "worker" }],

  globalConfigFixture: [globalConfigFixture, { scope: "worker" }],

  perTestConfigFixture: [perTestConfigFixture, { scope: "test" }]
});

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
