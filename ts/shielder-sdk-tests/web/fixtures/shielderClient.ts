import { mockedStorage } from "@/storage";
import type {
  InjectedStorageInterface,
  SendShielderTransaction,
  ShielderClient,
  Token
} from "@cardinal-cryptography/shielder-sdk";
import { createAccount, type SeededAccount } from "@tests/chainAccount";
import {
  ContractFunctionRevertedError,
  type TransactionExecutionError
} from "viem";
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
    to: `0x${string}`
  ) => Promise<{
    tx: `0x${string}`;
    totalFee: bigint;
  }>;
  shieldedBalance: (token: Token) => Promise<bigint>;
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
  const storage = mockedStorage(shielderKey);
  const cryptoClient = await window.wasmCryptoClient.cryptoClient;
  const sendingTransaction: SendShielderTransaction = async (calldata) => {
    const tx = await chainAccount
      .sendTransaction({
        ...calldata,
        gas: 3000000n
      })
      .catch((err: TransactionExecutionError) => {
        const revertError = err.walk(
          (err) => err instanceof ContractFunctionRevertedError
        );
        console.log(revertError);
        if (revertError instanceof ContractFunctionRevertedError) {
          const errorName = revertError.data?.errorName ?? "";
          console.log(errorName);
          // do something with `errorName`
        }
        throw err;
      });
    return tx;
  };
  const callbacks = setupCallbacks();
  const shielderClient = window.shielder.createShielderClient(
    shielderKey,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint,
    chainConfig.contractAddress,
    relayerConfig.url,
    storage,
    cryptoClient,
    callbacks.callbacks
  );

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
    withdraw: async (token, amount, to) => {
      const fees = await shielderClient.getWithdrawFees();
      return {
        tx: await shielderClient.withdraw(
          token,
          amount + fees.totalFee,
          fees.totalFee,
          to
        ),
        totalFee: fees.totalFee
      };
    },
    shieldedBalance: async (token) => {
      return shielderClient.accountState(token).then((state) => state.balance);
    }
  };
};
