import type { GlobalConfigFixture } from "./globalConfig";
import type { JSHandle, Page } from "@playwright/test";
import type { ShielderTestFixture } from "@/fixtures/shielderTest/setup";

export type PerTestConfigFixture = {
  testFixture: JSHandle<ShielderTestFixture>;
};

export const perTestConfigFixture = async (
  {
    workerPage,
    globalConfig
  }: { workerPage: Page; globalConfig: GlobalConfigFixture },
  use: (r: PerTestConfigFixture) => Promise<void>
) => {
  const testFixture = await workerPage.evaluateHandle(createWebFixture, {
    globalConfig
  });

  await use({ testFixture });

  await testFixture.dispose();
};

const createWebFixture = async ({
  globalConfig
}: {
  globalConfig: GlobalConfigFixture;
}): Promise<ShielderTestFixture> => {
  return await window.testFixtures.setupHappyTest(globalConfig);
};
