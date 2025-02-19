import { ShielderClientFixture } from "@/fixtures/setupShielderClient";
import { ACCOUNT_NAMES } from "@tests/constants";
import { generatePrivateKey } from "viem/accounts";
import { GlobalConfigFixture } from "./globalConfig";
import { JSHandle, Page } from "@playwright/test";
import { AccountKeys, AccountNames } from "@tests/types";

export type WebSdk = {
  [K in AccountNames]: ShielderClientFixture;
};

export type PerTestConfigFixture = {
  webSdk: JSHandle<WebSdk>;
};

export const perTestConfigFixture = async (
  {
    workerPage,
    globalConfig
  }: { workerPage: Page; globalConfig: GlobalConfigFixture },
  use: (r: PerTestConfigFixture) => Promise<void>
) => {
  const shielderKeys = {} as AccountKeys;
  for (const name of ACCOUNT_NAMES) {
    shielderKeys[name] = generatePrivateKey();
  }
  const webSdk = await workerPage.evaluateHandle(createWebSdk, {
    globalConfig,
    shielderKeys,
    accountNames: ACCOUNT_NAMES
  });

  await use({ webSdk });

  await webSdk.dispose();
};

const createWebSdk = async ({
  globalConfig,
  shielderKeys,
  accountNames
}: {
  globalConfig: GlobalConfigFixture;
  shielderKeys: AccountKeys;
  accountNames: typeof ACCOUNT_NAMES;
}): Promise<WebSdk> => {
  const webSdk = {} as WebSdk;

  for (const name of accountNames) {
    const clientFixture = await window.testFixtures.setupShielderClient(
      globalConfig.chainConfig,
      globalConfig.relayerConfig,
      globalConfig.privateKeys[name],
      shielderKeys[name]
    );
    webSdk[name] = clientFixture;
  }
  return webSdk;
};
