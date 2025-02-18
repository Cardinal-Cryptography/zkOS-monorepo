import { ACCOUNT_NAMES, AccountKeys } from "@tests/constants";
import { generatePrivateKey } from "viem/accounts";

export type PerTestConfigFixture = {
  shielderKeys: AccountKeys;
};

export const perTestConfigFixture = async (
  // eslint-disable-next-line no-empty-pattern
  {},
  use: (r: PerTestConfigFixture) => Promise<void>
) => {
  const shielderKeys = {} as AccountKeys;

  for (const name of ACCOUNT_NAMES) {
    shielderKeys[name] = generatePrivateKey();
  }

  await use({ shielderKeys });
};
