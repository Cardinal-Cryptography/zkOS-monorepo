import {
  Contract,
  Relayer,
  Scalar,
  ShielderClient,
  stateChangingEvents,
  type AccountState,
  type InjectedStorageInterface,
  type SendShielderTransaction,
} from "shielder-sdk/__internal__";
import {
  ContractFunctionRevertedError,
  createPublicClient,
  createTestClient,
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
  type TestClient,
  type WalletClient,
  type WalletRpcSchema,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createNonceManager, jsonRpc } from "viem/nonce";

const chainName = "devnet";
const chainNativeCurrency = {
  name: "AZERO",
  symbol: "AZERO",
  decimals: 18,
};

export class DevnetManager {
  testClient: TestClient;

  /**
   *
   * @param privateKey use private key prefilled with funds
   * @param chainId devnet chain id
   * @param rpcHttpEndpoint devnet rpc endpoint
   */
  constructor(chainId: number, rpcHttpEndpoint: string) {
    this.testClient = createTestClient({
      chain: defineChain({
        name: chainName,
        id: chainId,
        rpcUrls: {
          default: {
            http: [rpcHttpEndpoint],
          },
        },
        nativeCurrency: chainNativeCurrency,
      }),
      mode: "anvil",
      transport: http(),
    });
  }

  async setBalance(address: `0x${string}`, value: bigint) {
    await this.testClient.setBalance({
      address,
      value,
    });
  }
}

export interface ContractTestFixture {
  contract: Contract;
  shielderClient: ShielderClient;
  relayer?: Relayer;
  alicePublicAccount: SeededAccount;
  devnetManager: DevnetManager;
  storage: InjectedStorageInterface;
  aliceSendTransaction: SendShielderTransaction;
}

export const setupContractTest = async (
  initialPublicBalance: bigint,
  chainConfig: {
    chainId: number;
    rpcHttpEndpoint: string;
    contractAddress: `0x${string}`;
  },
  privateKeyAlice: `0x${string}`,
  relayerConfig?: {
    address: `0x${string}`;
    url: string;
    relayerSignerAddresses: `0x${string}`[];
  },
): Promise<ContractTestFixture> => {
  const devnetManager = window.chain.testUtils.createDevnetManager(
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint,
  );
  const alicePublicAccount: SeededAccount = createAccount(
    privateKeyAlice,
    chainConfig.chainId,
    chainConfig.rpcHttpEndpoint,
  );
  const publicClient = createPublicClient({
    chain: defineChain({
      name: chainName,
      id: chainConfig.chainId,
      rpcUrls: {
        default: {
          http: [chainConfig.rpcHttpEndpoint],
        },
      },
      nativeCurrency: chainNativeCurrency,
    }),
    transport: http(),
  });
  await devnetManager.setBalance(
    alicePublicAccount.account.address,
    initialPublicBalance,
  );
  if (relayerConfig) {
    for (const relayerAddress of relayerConfig.relayerSignerAddresses) {
      await devnetManager.setBalance(relayerAddress, 5n * 10n ** 18n);
    }
  }
  const contract = window.chain.createContract(
    publicClient,
    chainConfig.contractAddress,
  );
  let relayer: Relayer | undefined = undefined;
  if (relayerConfig) {
    relayer = window.chain.createRelayer(
      relayerConfig.url,
      relayerConfig.address,
    );
  }
  const storage = window.storage.mockedStorage(
    alicePublicAccount.account.address,
  );
  const aliceSendTransaction: SendShielderTransaction = async (calldata) => {
    const tx = await alicePublicAccount
      .sendTransaction({
        ...calldata,
        // gas: 3000000n,
      })
      .catch((err: TransactionExecutionError) => {
        const revertError = err.walk(
          (err) => err instanceof ContractFunctionRevertedError,
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
    relayerConfig ? relayerConfig.address : "0x",
    relayerConfig ? relayerConfig.url : "",
    storage,
  );

  return {
    contract,
    shielderClient,
    relayer,
    alicePublicAccount,
    devnetManager,
    storage,
    aliceSendTransaction,
  };
};

export const getEvent = async (
  contract: Contract,
  state: AccountState,
  blockNumber: bigint,
) => {
  const events = await stateChangingEvents(
    state,
    await contract.getNoteEventsFromBlock(blockNumber),
  );
  if (events.length !== 1) {
    console.log(events);
    throw new Error("Expected one event");
  }
  const event = events[0];
  return event;
};

export const getValidatedMerklePath = async (
  merkleTreeIdx: bigint,
  contract: Contract,
  note: Scalar,
) => {
  // get the merkle path of the new note
  const merklePath = await contract.getMerklePath(merkleTreeIdx);
  // validate the merkle path
  const hasher = window.crypto.createHasher();
  const arity = hasher.arity();
  const treeHeight = hasher.treeHeight();
  if (merklePath.length !== arity * treeHeight + 1)
    throw new Error("Unexpected merkle path length");
  // validate the merkle path
  let scalarMerklePath = merklePath.map((x) =>
    window.crypto.scalar.fromBigint(x),
  );
  let leaf = note;
  for (let height = 0; height < treeHeight; height++) {
    if (
      scalarMerklePath
        .slice(0, arity)
        .filter(
          (x) =>
            window.crypto.scalar.scalarToBigint(x) ===
            window.crypto.scalar.scalarToBigint(leaf),
        ).length !== 1
    )
      throw new Error(`Doesn't contain leaf: height ${height}`);
    leaf = hasher.poseidonHash(scalarMerklePath.slice(0, arity));
    scalarMerklePath = scalarMerklePath.slice(arity);
  }
  return merklePath;
};

export const createAccount = (
  privateKey: `0x${string}`,
  chainId: number,
  rpcHttpEndpoint: string,
): WalletClient<HttpTransport, Chain, PrivateKeyAccount, WalletRpcSchema> &
  PublicClient<HttpTransport, Chain, PrivateKeyAccount, PublicRpcSchema> => {
  const nonceManager = createNonceManager({
    source: jsonRpc(),
  });
  const privateKeyAccount: PrivateKeyAccount = privateKeyToAccount(privateKey, {
    nonceManager,
  }) as PrivateKeyAccount;
  const account = createWalletClient({
    account: privateKeyAccount,
    chain: defineChain({
      name: chainName,
      id: chainId,
      rpcUrls: {
        default: {
          http: [rpcHttpEndpoint],
        },
      },
      nativeCurrency: chainNativeCurrency,
    }),
    transport: http(),
  }).extend(publicActions);
  return account;
};

export type SeededAccount = ReturnType<typeof createAccount>;
