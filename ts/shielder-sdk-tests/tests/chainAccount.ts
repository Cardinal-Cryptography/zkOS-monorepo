import {
  createNonceManager,
  createWalletClient,
  createPublicClient as createPublicClientViem,
  defineChain,
  http,
  publicActions,
  type Chain,
  type HttpTransport,
  type PrivateKeyAccount,
  type PublicClient,
  type PublicRpcSchema,
  type WalletClient,
  type WalletRpcSchema,
  erc20Abi,
  getContract
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { jsonRpc } from "viem/nonce";

const chainName = "azero";
const chainNativeCurrency = {
  name: "AZERO",
  symbol: "AZERO",
  decimals: 18
};

export interface NativeActions {
  sendNative(to: `0x${string}`, value: bigint): Promise<void>;
  balanceNative(): Promise<bigint>;
}

export interface ERC20Actions {
  sendERC20(
    token: `0x${string}`,
    to: `0x${string}`,
    value: bigint
  ): Promise<void>;
  approveERC20(
    token: `0x${string}`,
    spender: `0x${string}`,
    value: bigint
  ): Promise<void>;
  balanceERC20(token: `0x${string}`): Promise<bigint>;
}

export const createAccount = (
  privateKey: `0x${string}`,
  chainId: number,
  rpcHttpEndpoint: string
): WalletClient<HttpTransport, Chain, PrivateKeyAccount, WalletRpcSchema> &
  PublicClient<HttpTransport, Chain, PrivateKeyAccount, PublicRpcSchema> &
  NativeActions &
  ERC20Actions => {
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
  })
    .extend(publicActions)
    .extend((client) => ({
      sendNative: async (to: `0x${string}`, value: bigint) => {
        const txHash = await client.sendTransaction({
          to,
          value
        });
        const receipt = await client.waitForTransactionReceipt({
          hash: txHash
        });
        if (receipt.status !== "success") {
          throw new Error("Faucet failed");
        }
      },
      balanceNative: async () => {
        return await client.getBalance({
          address: client.account.address
        });
      },
      sendERC20: async (
        token: `0x${string}`,
        to: `0x${string}`,
        value: bigint
      ) => {
        const contract = getContract({
          address: token,
          abi: erc20Abi,
          client
        });
        const txHash = await contract.write.transfer([to, value]);
        const receipt = await client.waitForTransactionReceipt({
          hash: txHash
        });
        if (receipt.status !== "success") {
          throw new Error("ERC20 transfer failed");
        }
      },
      approveERC20: async (
        token: `0x${string}`,
        spender: `0x${string}`,
        value: bigint
      ) => {
        const contract = getContract({
          address: token,
          abi: erc20Abi,
          client
        });
        const txHash = await contract.write.approve([spender, value]);
        const receipt = await client.waitForTransactionReceipt({
          hash: txHash
        });
        if (receipt.status !== "success") {
          throw new Error("ERC20 approve failed");
        }
      },
      balanceERC20: async (token: `0x${string}`) => {
        const contract = getContract({
          address: token,
          abi: erc20Abi,
          client
        });
        return await contract.read.balanceOf([client.account.address]);
      }
    }));
  return account;
};

export type SeededAccount = ReturnType<typeof createAccount>;

export const createPublicClient = (rpcHttpEndpoint: string): PublicClient => {
  return createPublicClientViem({
    transport: http(rpcHttpEndpoint)
  });
};
