import { mockedStorage } from "@/storage";
import {
  InjectedStorageInterface,
  SendShielderTransaction,
  ShielderCallbacks,
  ShielderClient
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

export interface ShielderClientFixture {
  shielderClient: ShielderClient;
  signerAccount: SeededAccount;
  storage: InjectedStorageInterface & {
    clear: () => void;
  };
  aliceSendTransaction: SendShielderTransaction;
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
  shielderKey: `0x${string}`,
  clientCallbacks?: ShielderCallbacks
): Promise<ShielderClientFixture> => {
  const signerAccount: SeededAccount = createAccount(
    privateKey,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint
  );
  const storage = mockedStorage(shielderKey);
  const cryptoClient = await window.wasmCryptoClient.cryptoClient;
  const aliceSendTransaction: SendShielderTransaction = async (calldata) => {
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
  const shielderClient = window.shielder.createShielderClient(
    shielderKey,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint,
    chainConfig.contractAddress,
    relayerConfig.url,
    storage,
    cryptoClient,
    clientCallbacks
  );

  return {
    shielderClient,
    signerAccount,
    storage,
    aliceSendTransaction
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
