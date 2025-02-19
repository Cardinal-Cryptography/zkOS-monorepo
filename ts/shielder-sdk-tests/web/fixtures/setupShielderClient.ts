import { mockedStorage } from "@/storage";
import {
  InjectedStorageInterface,
  SendShielderTransaction,
  ShielderCallbacks,
  ShielderClient,
  ShielderOperation,
  ShielderTransaction,
  Token
} from "@cardinal-cryptography/shielder-sdk";
import {
  ContractFunctionRevertedError,
  createWalletClient,
  defineChain,
  http,
  publicActions,
  TransactionExecutionError,
  type Chain,
  type HttpTransport,
  type PrivateKeyAccount,
  type PublicClient,
  type PublicRpcSchema,
  type WalletClient,
  type WalletRpcSchema
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createNonceManager, jsonRpc } from "viem/nonce";

const chainName = "azero";
const chainNativeCurrency = {
  name: "AZERO",
  symbol: "AZERO",
  decimals: 18
};

export interface CallbacksFixture {
  callbacks: ShielderCallbacks;
  txHistory: () => ShielderTransaction[];
  calldataGeneratedHistory: () => ShielderOperation[];
  calldataSentHistory: () => ShielderOperation[];
  clearHistory: () => void;
}

const setupCallbacks = (): CallbacksFixture => {
  let txHistory: ShielderTransaction[] = [];
  let calldataGeneratedHistory: ShielderOperation[] = [];
  let calldataSentHistory: ShielderOperation[] = [];

  const callbacks: ShielderCallbacks = {
    onNewTransaction: (tx) => {
      txHistory.push(tx);
    },
    onCalldataGenerated: (_, op) => {
      calldataGeneratedHistory.push(op);
    },
    onCalldataSent: (_, op) => {
      calldataSentHistory.push(op);
    }
  };

  const clearHistory = () => {
    txHistory = [];
    calldataGeneratedHistory = [];
    calldataSentHistory = [];
  };

  return {
    callbacks,
    txHistory: () => txHistory,
    calldataGeneratedHistory: () => calldataGeneratedHistory,
    calldataSentHistory: () => calldataSentHistory,
    clearHistory
  };
};

export interface ShielderClientFixture {
  shielderClient: ShielderClient;
  signerAccount: SeededAccount;
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
  getBalance: (token: Token) => Promise<bigint>;
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
  const signerAccount: SeededAccount = createAccount(
    privateKey,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint
  );
  const storage = mockedStorage(shielderKey);
  const cryptoClient = await window.wasmCryptoClient.cryptoClient;
  const sendingTransaction: SendShielderTransaction = async (calldata) => {
    const tx = await signerAccount
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
    signerAccount,
    storage,
    sendingTransaction,
    callbacks,
    shield: async (token, amount) => {
      return shielderClient.shield(
        token,
        amount,
        sendingTransaction,
        signerAccount.account.address
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
    getBalance: async (token) => {
      return shielderClient.accountState(token).then((state) => state.balance);
    }
  };
};

export const createAccount = (
  privateKey: `0x${string}`,
  chainId: number,
  rpcHttpEndpoint: string
): WalletClient<HttpTransport, Chain, PrivateKeyAccount, WalletRpcSchema> &
  PublicClient<HttpTransport, Chain, PrivateKeyAccount, PublicRpcSchema> => {
  const nonceManager = createNonceManager({
    source: jsonRpc()
  });
  const privateKeyAccount: PrivateKeyAccount = privateKeyToAccount(privateKey, {
    nonceManager
  });
  const account = createWalletClient({
    account: privateKeyAccount,
    chain: defineChain({
      name: chainName,
      id: chainId,
      rpcUrls: {
        default: {
          http: [rpcHttpEndpoint]
        }
      },
      nativeCurrency: chainNativeCurrency
    }),
    transport: http()
  }).extend(publicActions);
  return account;
};

export type SeededAccount = ReturnType<typeof createAccount>;
