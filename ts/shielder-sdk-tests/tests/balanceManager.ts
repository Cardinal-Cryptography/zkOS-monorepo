import {
  Chain,
  createTestClient,
  defineChain,
  http,
  HttpTransport,
  PrivateKeyAccount,
  publicActions,
  PublicClient,
  PublicRpcSchema,
  TestClient,
  walletActions,
  WalletClient,
  WalletRpcSchema
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
