import { ShielderClientFixture } from "@/fixtures/setupShielderClient";
import { ACCOUNT_NAMES } from "@tests/constants";
import { generatePrivateKey } from "viem/accounts";
import { GlobalConfigFixture } from "./globalConfig";
import { JSHandle, Page } from "@playwright/test";
import { AccountNames, AccountValue } from "@tests/types";

export type PerTestConfigFixture = {
  webSdk: JSHandle<AccountValue<ShielderClientFixture>>;
};

export const perTestConfigFixture = async (
  {
    workerPage,
    globalConfig
  }: { workerPage: Page; globalConfig: GlobalConfigFixture },
  use: (r: PerTestConfigFixture) => Promise<void>
) => {
  const shielderKeys = {} as AccountValue<`0x${string}`>;
  for (const name of ACCOUNT_NAMES) {
    shielderKeys[name] = generatePrivateKey();
  }
  const webSdk = await workerPage.evaluateHandle(createWebSdk, {
    globalConfig,
    shielderKeys
  });

  await use({ webSdk });

  await webSdk.dispose();
};

const createWebSdk = async ({
  globalConfig,
  shielderKeys
}: {
  globalConfig: GlobalConfigFixture;
  shielderKeys: AccountValue<`0x${string}`>;
}): Promise<AccountValue<ShielderClientFixture>> => {
  const webSdk = {} as AccountValue<ShielderClientFixture>;

  for (const untypedActor in shielderKeys) {
    const name = untypedActor as AccountNames;
    console.log("name", name);
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
