# `shielder-sdk-crypto`

Core cryptographic module for the Shielder SDK, defining the lower-level cryptography interface used for private transactions on the Shielder Network.

## Overview

This package provides the foundational cryptographic interfaces and types required by the Shielder protocol, including:

- Field element representation
- Zero-knowledge proofs (ZKP)
- Hashing functions
- Secret derivation

The module defines interfaces that are implemented by platform-specific packages (such as `shielder-sdk-crypto-wasm`), allowing the main SDK to work across different environments.

## Core Components

### Field Element Representation

The module provides a `Scalar` class for representing field elements in the BN256 curve:

```typescript
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";

// Create a scalar from a bigint
const scalar = Scalar.fromBigint(42n);

// Create a scalar from an Ethereum address
const addressScalar = Scalar.fromAddress(
  "0x7FfA893F1671600ec9b09542B5a432593720B3ee"
);

// Convert scalar back to bigint
const value = scalarToBigint(scalar);

// Compare scalars
const areEqual = scalarsEqual(scalar1, scalar2);
```

### Zero-Knowledge Proofs

The module defines interfaces for generating and verifying zero-knowledge proofs for key operations in the Shielder protocol:

- `NewAccountCircuit`: For creating new private accounts
- `DepositCircuit`: For depositing tokens into private accounts
- `WithdrawCircuit`: For withdrawing tokens from private accounts

Each circuit interface provides methods for:

- Generating proofs
- Computing public inputs
- Verifying proofs

### Hashing Functions

The `Hasher` interface provides cryptographic hashing functionality for Poseidon2 function:

```typescript
// Poseidon2 hash of multiple scalar inputs
const hash = await cryptoClient.hasher.poseidonHash([scalar1, scalar2]);

// Get the maximum number of inputs supported
const rate = await cryptoClient.hasher.poseidonRate();
```

### Secret Derivation

The `SecretManager` interface handles the derivation of secrets for private transactions:

```typescript
// Derive account ID from private key, chain ID, and token address
const id = await cryptoClient.secretManager.deriveId(
  "0xprivatekey",
  1n, // chain ID
  "0xtokenAddress"
);

// Get secrets (trapdoor & nullifier) for a specific account and nonce
const { nullifier, trapdoor } = await cryptoClient.secretManager.getSecrets(
  id,
  nonce
);
```

## Implementations

The interfaces defined in this package are implemented by:

- **WebAssembly Implementation** (`@cardinal-cryptography/shielder-sdk-crypto-wasm`)
