import { BalanceManager } from "@tests/balanceManager";
import { getChainConfig, getRelayerConfig } from "@tests/chainConfig";
import { ACCOUNT_NAMES, INITIAL_EVM_BALANCE } from "@tests/constants";
import { AccountKeys } from "@tests/types";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

export type GlobalConfigFixture = {
  chainConfig: ReturnType<typeof getChainConfig>;
  relayerConfig: ReturnType<typeof getRelayerConfig>;
  privateKeys: AccountKeys;
};

export const globalConfigFixture = async (
  // eslint-disable-next-line no-empty-pattern
  {},
  use: (r: GlobalConfigFixture) => Promise<void>
) => {
  const chainConfig = getChainConfig();
  const relayerConfig = getRelayerConfig();

  const privateKeys = {} as AccountKeys;

  for (const name of ACCOUNT_NAMES) {
    privateKeys[name] = generatePrivateKey();
  }

  const balanceManager = new BalanceManager(
    chainConfig.rpcHttpEndpoint,
    chainConfig.chainId,
    chainConfig.testnetPrivateKey
  );

  for (const name of ACCOUNT_NAMES) {
    await balanceManager.setBalance(
      privateKeyToAddress(privateKeys[name]),
      INITIAL_EVM_BALANCE
    );
  }

  await use({ chainConfig, relayerConfig, privateKeys });
};
