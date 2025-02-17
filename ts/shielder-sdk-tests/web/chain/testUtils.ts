import { mockedStorage } from "@/storage";
import {
  InjectedStorageInterface,
  SendShielderTransaction,
  ShielderClient
} from "@cardinal-cryptography/shielder-sdk";
import {
  ContractFunctionRevertedError,
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
  publicActions,
  walletActions,
  TransactionExecutionError,
  type Chain,
  type HttpTransport,
  type PrivateKeyAccount,
  type PublicClient,
  type PublicRpcSchema,
  type WalletClient,
  type WalletRpcSchema,
  TestClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createNonceManager, jsonRpc } from "viem/nonce";

const chainName = "azero";
const chainNativeCurrency = {
  name: "AZERO",
  symbol: "AZERO",
  decimals: 18
};

export class BalanceManager {
  testClient: TestClient &
    WalletClient<HttpTransport, Chain, PrivateKeyAccount, WalletRpcSchema> &
    PublicClient<HttpTransport, Chain, PrivateKeyAccount, PublicRpcSchema>;
  isAnvil: boolean;

  /**
   *
   * @param privateKey use private key prefilled with funds
   * @param rpcHttpEndpoint rpc endpoint
   */
  constructor(
    rpcHttpEndpoint: string,
    chainId: number,
    testnetPrivateKey: `0x${string}`
  ) {
    this.testClient = createTestClient({
      account: privateKeyToAccount(testnetPrivateKey),
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
      mode: "anvil",
      transport: http()
    })
      .extend(publicActions)
      .extend(walletActions);
    this.isAnvil = rpcHttpEndpoint.includes("localhost");
  }

  async setBalance(address: `0x${string}`, value: bigint) {
    if (this.isAnvil) {
      await this.testClient.setBalance({
        address,
        value
      });
      return;
    }
    const txHash = await this.testClient.sendTransaction({
      to: address,
      value
    });
    const receipt = await this.testClient.waitForTransactionReceipt({
      hash: txHash
    });
    if (receipt.status !== "success") {
      throw new Error("Faucet failed");
    }
  }
}

export interface ContractTestFixture {
  shielderClient: ShielderClient;
  alicePublicAccount: SeededAccount;
  balanceManager: BalanceManager;
  storage: InjectedStorageInterface;
  aliceSendTransaction: SendShielderTransaction;
}

export const setupContractTest = async (
  initialPublicBalance: bigint,
  chainConfig: {
    chainId: number;
    rpcHttpEndpoint: string;
    contractAddress: `0x${string}`;
    testnetPrivateKey: `0x${string}`;
  },
  relayerConfig: {
    url: string;
  },
  privateKeyAlice: `0x${string}`
): Promise<ContractTestFixture> => {
  const balanceManager = new BalanceManager(
    chainConfig.rpcHttpEndpoint,
    chainConfig.chainId,
    chainConfig.testnetPrivateKey
  );
  const alicePublicAccount: SeededAccount = createAccount(
    privateKeyAlice,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint
  );
  await balanceManager.setBalance(
    alicePublicAccount.account.address,
    initialPublicBalance
  );
  const storage = mockedStorage(alicePublicAccount.account.address);
  const cryptoClient = await window.wasmCryptoClient.cryptoClient;
  const aliceSendTransaction: SendShielderTransaction = async (calldata) => {
    const tx = await alicePublicAccount
      .sendTransaction({
        ...calldata
        // gas: 3000000n,
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
    privateKeyAlice,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint,
    chainConfig.contractAddress,
    relayerConfig.url,
    storage,
    cryptoClient
  );

  return {
    shielderClient,
    alicePublicAccount,
    balanceManager: balanceManager,
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
  }) as PrivateKeyAccount;
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
