import { mockedStorage } from "@/storage";
import type {
  InjectedStorageInterface,
  SendShielderTransaction,
  ShielderClient,
  Token
} from "@cardinal-cryptography/shielder-sdk";
import {
  createAccount,
  createPublicClient,
  type SeededAccount
} from "@tests/chainAccount";
import { type CallbacksFixture, setupCallbacks } from "./callbacks";

export interface ShielderClientFixture {
  shielderClient: ShielderClient;
  chainAccount: SeededAccount;
  storage: InjectedStorageInterface & {
    clear: () => void;
  };
  sendingTransaction: SendShielderTransaction;
  callbacks: CallbacksFixture;
  shield: (token: Token, amount: bigint) => Promise<`0x${string}`>;
  withdraw: (
    token: Token,
    amount: bigint,
    to: `0x${string}`,
    pocketMoney: bigint
  ) => Promise<{
    tx: `0x${string}`;
    totalFee: bigint;
  }>;
  withdrawManual: (
    token: Token,
    amount: bigint,
    to: `0x${string}`
  ) => Promise<`0x${string}`>;
  shieldedBalance: (token: Token) => Promise<bigint | null>;
}

export const setupShielderClient = async (
  chainConfig: {
    chainId: number;
    rpcHttpEndpoint: string;
    contractAddress: `0x${string}`;
    testnetPrivateKey: `0x${string}`;
  },
  relayerConfig: {
    url: string;
  },
  privateKey: `0x${string}`,
  shielderKey: `0x${string}`
): Promise<ShielderClientFixture> => {
  const chainAccount: SeededAccount = createAccount(
    privateKey,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint
  );
  const publicClient = createPublicClient(chainConfig.rpcHttpEndpoint);
  const storage = mockedStorage(shielderKey);
  const cryptoClient = await window.wasmCryptoClient.cryptoClient;
  const sendingTransaction: SendShielderTransaction = async (calldata) => {
    const tx = await chainAccount.sendTransaction({
      ...calldata,
      gas: 3000000n
    });
    return tx;
  };
  const callbacks = setupCallbacks();
  const shielderClient = window.shielder.createShielderClient({
    shielderSeedPrivateKey: shielderKey,
    chainId: BigInt(chainConfig.chainId),
    publicClient,
    contractAddress: chainConfig.contractAddress,
    relayerUrl: relayerConfig.url,
    storage,
    cryptoClient,
    callbacks: callbacks.callbacks
  });

  return {
    shielderClient,
    chainAccount,
    storage,
    sendingTransaction,
    callbacks,
    shield: async (token, amount) => {
      if (token.type === "erc20")
        await chainAccount.approveERC20(
          token.address,
          chainConfig.contractAddress,
          amount
        );
      return shielderClient.shield(
        token,
        amount,
        sendingTransaction,
        chainAccount.account.address
      );
    },
    withdraw: async (token, amount, to, pocketMoney) => {
      const fees = await shielderClient.getWithdrawFees(token, pocketMoney);
      return {
        tx: await shielderClient.withdraw(
          token,
          amount + fees.fee_details.total_cost_fee_token,
          fees,
          to,
          pocketMoney
        ),
        totalFee: fees.fee_details.total_cost_fee_token
      };
    },
    withdrawManual: async (token, amount, to) => {
      return shielderClient.withdrawManual(
        token,
        amount,
        to,
        sendingTransaction,
        chainAccount.account.address
      );
    },
    shieldedBalance: async (token) => {
      return shielderClient
        .accountState(token)
        .then((state) => (state ? state.balance : null));
    }
  };
};
