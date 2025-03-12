# `shielder-sdk`

A TypeScript package for interacting with the Shielder Network. The SDK enables developers to integrate private EVM transactions into their applications.

## Key Features

- **Account Management**: Create and manage private accounts
- **Private Transactions**: Shield and unshield tokens
- **State Management**: Track and sync account state
- **Event Monitoring**: Callbacks for transaction lifecycle events

## Usage

The main entry point is the `createShielderClient` function, which creates `ShielderClient` instance with methods for shielding, withdrawing, and retrieving the account state

### Basic Example

```typescript
import { createShielderClient, nativeToken } from "@cardinal-cryptography/shielder-sdk";
import { CryptoClient } from "shielder-sdk-crypto";
import { createPublicClient, http } from "viem";

// Create a viem public client
const publicClient = createPublicClient({
  chain: { id: 12345 },
  transport: http("https://rpc.url")
});

// Initialize the client
const shielderClient = createShielderClient({
  shielderSeedPrivateKey: "0xprivatekey", // 32-byte hex format private key
  chainId: 12345n, // blockchain chain ID as bigint
  publicClient, // viem public client
  contractAddress: "0xcontractaddr", // Shielder contract address
  relayerUrl: "https://relayer.url", // URL of the relayer service
  storage, // Storage interface for managing state (see InjectedStorageInterface)
  cryptoClient, // Instance of CryptoClient
  callbacks: { ... } // Optional callbacks for monitoring operations
});

// Shield native tokens
await shielderClient.shield(
  nativeToken(), // Token to shield (native token)
  1000n, // Amount to shield (in wei)
  sendShielderTransaction, // Function to send transaction
  "0x..." // From address
);
```

### Token Types

The SDK supports both native tokens and ERC20 tokens:

```typescript
import { nativeToken, erc20Token } from "@cardinal-cryptography/shielder-sdk";

// Create a native token reference
const native = nativeToken();

// Create an ERC20 token reference
const usdc = erc20Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
```

### Storage Interface

The SDK requires a storage interface for managing state. This interface must implement the `InjectedStorageInterface`:

```typescript
interface InjectedStorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}
```

You can use browser's localStorage, React Native's AsyncStorage, or any other storage solution that implements this interface.

### CryptoClient

The `CryptoClient` is a general interface for platform-dependent cryptographic operations required by the Shielder protocol. It is defined in `shielder-sdk-crypto` package.

Currently available implementations:

- **WebAssembly Implementation** (`shielder-sdk-crypto-wasm`): A high-performance implementation that leverages WebAssembly for cryptographic operations.

### Common Operations

#### Shielding Tokens

```typescript
// Shield native tokens
const txHash = await shielderClient.shield(
  nativeToken(), // Token to shield
  amount, // Amount in wei
  sendShielderTransaction, // Transaction sender function
  fromAddress // Sender's address
);

// Shield ERC20 tokens
const txHash = await shielderClient.shield(
  erc20Token("0xTokenAddress"), // Token to shield
  amount, // Amount in wei
  sendShielderTransaction, // Transaction sender function
  fromAddress // Sender's address
);
```

#### Withdrawing Tokens

```typescript
// Get current withdraw fees
const fees = await shielderClient.getWithdrawFees();

// Withdraw native tokens
const txHash = await shielderClient.withdraw(
  nativeToken(), // Token to withdraw
  amount, // Amount in wei
  fees.totalFee, // Total fee for the operation
  toAddress // Recipient's address
);
```

#### Manual Withdrawal (Bypassing Relayer)

```typescript
// Withdraw tokens directly (non-anonymous)
const txHash = await shielderClient.withdrawManual(
  nativeToken(), // Token to withdraw
  amount, // Amount in wei
  toAddress, // Recipient's address
  sendShielderTransaction, // Transaction sender function
  fromAddress // Sender's address
);
```

#### Syncing State

```typescript
// Sync the local state with blockchain for all tokens
await shielderClient.syncShielder();

// Get current account state for a specific token
const state = await shielderClient.accountState(nativeToken());

// Scan chain for all transactions
for await (const tx of shielderClient.scanChainForTokenShielderTransactions()) {
  console.log("Transaction:", tx);
}
```

### Callbacks

The SDK supports various callbacks to monitor operations:

```typescript
const callbacks = {
  // Called after calldata is generated
  onCalldataGenerated: (calldata, operation) => {
    console.log(`Calldata generated for ${operation}`);
  },
  // Called after calldata is sent
  onCalldataSent: (txHash, operation) => {
    console.log(`Transaction ${txHash} sent for ${operation}`);
  },
  // Called when new transactions are synchronized
  onNewTransaction: (tx) => {
    console.log("New transaction:", tx);
  },
  // Called when errors occur
  onError: (error, stage, operation) => {
    console.error(`Error in ${stage} stage of ${operation}:`, error);
  }
};
```

## Implementation details

**TODO**
