import type { Token } from "@cardinal-cryptography/shielder-sdk";
import { createAccount } from "@tests/chainAccount";

export interface WithdrawalAccountFixture {
  address: `0x${string}`;
  balance(token: Token): Promise<bigint>;
}

export const setupWithdrawalAccount = (
  privateKey: `0x${string}`,
  chainId: number,
  rpcHttpEndpoint: string
): WithdrawalAccountFixture => {
  const account = createAccount(privateKey, chainId, rpcHttpEndpoint);
  return {
    address: account.account.address,
    balance: async (token: Token) => {
      if (token.type === "native") {
        return await account.balanceNative();
      }
      return await account.balanceERC20(token.address);
    }
  };
};
