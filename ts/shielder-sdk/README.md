# `shielder-sdk`

A TypeScript package for interacting with Shielder, a part of zkOS privacy engine. This SDK enables users to perform private transactions and manage accounts within the Shielder protocol.

## Key Features

- **Account Management**: Create and manage private accounts
- **Private Transactions**: Shield and unshield tokens
- **State Management**: Track and sync account state
- **Event Monitoring**: Callbacks for transaction lifecycle events

## Usage

The main entry point is the `createShielderClient` function which provides methods for interacting with the Shielder protocol.

### Basic Example

```typescript
import { createShielderClient } from "@cardinal-cryptography/shielder-sdk";
import { CryptoClient } from "shielder-sdk-crypto";

// Initialize the client
const shielderClient = createShielderClient(
  shielderSeedPrivateKey, // 32-byte hex format private key
  chainId, // blockchain chain ID
  rpcHttpEndpoint, // blockchain RPC endpoint
  contractAddress, // Shielder contract address
  relayerUrl, // URL of the relayer service
  storage, // Storage interface for managing state
  cryptoClient, // Instance of CryptoClient
  callbacks // Optional callbacks for monitoring operations
);

// Shield tokens
await shielderClient.shield(
  1000n, // Amount to shield (in wei)
  sendShielderTransaction, // Function to send transaction
  "0x..." // From address
);
```

### CryptoClient

The `CryptoClient` is a general interface for platform-dependent cryptographic operations required by the Shielder protocol. It is defined in `shielder-sdk-crypto` package.

Currently available implementations:

- **WebAssembly Implementation** (`shielder-sdk-crypto-wasm`): A high-performance implementation that leverages WebAssembly for cryptographic operations.

### Common Operations

#### Shielding Tokens

```typescript
const txHash = await shielderClient.shield(
  amount, // Amount in wei
  sendShielderTransaction, // Transaction sender function
  fromAddress // Sender's address
);
```

#### Withdrawing Tokens

```typescript
// Get current withdraw fees
const fees = await shielderClient.getWithdrawFees();

// Withdraw tokens
const txHash = await shielderClient.withdraw(
  amount, // Amount in wei
  fees.totalFee, // Total fee for the operation
  toAddress // Recipient's address
);
```

#### Syncing State

```typescript
// Sync the local state with blockchain
await shielderClient.syncShielder();

// Get current account state
const state = await shielderClient.accountState();
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
  // Called when new transactions are found
  onNewTransaction: (tx) => {
    console.log("New transaction:", tx);
  },
  // Called when errors occur
  onError: (error, stage, operation) => {
    console.error(`Error in ${stage} stage of ${operation}:`, error);
  }
};
```
