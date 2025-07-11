# Shielder TypeScript SDK

This directory contains the TypeScript SDK for interacting with the Shielder Network. The SDK enables developers to integrate private EVM transactions into their applications.

## Package Structure

The TypeScript SDK is organized into three main packages:

### `/shielder-sdk`

The main TypeScript SDK for interacting with the Shielder Network. This package provides high-level functionality for:

- **Account Management**: Create and manage private accounts
- **Private Transactions**: Shield and unshield tokens
- **State Management**: Track and sync account state
- **Event Monitoring**: Callbacks for transaction lifecycle events

[`shielder-sdk` Documentation](./shielder-sdk/README.md)

### `/shielder-sdk-crypto`

Core cryptographic module for `shielder-sdk`, defining the lower-level cryptography interface for:

- Field element representation
- Zero-knowledge proofs (ZKP)
- Hashing functions
- Secret derivation

This package defines the `CryptoClient` interface that must be implemented by platform-specific cryptography providers.

[`shielder-sdk-crypto` Documentation](./shielder-sdk-crypto/README.md)

### `/shielder-sdk-crypto-wasm`

WebAssembly implementation of `shielder-sdk-crypto` for web browser environments. This package provides:

- Single- or multi-threaded WASM code, generated from Rust
- Appropriate setup functions for browser integration

[`shielder-sdk-crypto-wasm` Documentation](./shielder-sdk-crypto-wasm/README.md)

## Prerequisites

Before getting started, ensure you have:

- [Node.js](https://nodejs.org/) (v22 or later)
- [pnpm](https://pnpm.io/) package manager
- [foundry](https://getfoundry.sh/) (v1.0)
- [Docker](https://www.docker.com/) (for E2E tests)

## Building from Source

While these packages will be available on npm for production use, you can build them locally from source code for development and testing purposes.

### Building WASM Dependencies

The SDK requires WebAssembly bindings for cryptographic operations. To build these locally:

```bash
# Navigate to the bindings crate
cd ../crates/shielder_bindings

# Build the WASM package
make wasm
```

### Compiling Contract Dependencies

The SDK interacts with Shielder smart contracts. To compile these locally:

```bash
# Navigate to the monorepo root
cd ../..

# Compile the contracts
make compile-contracts
```

### Building TypeScript Packages

After setting up the dependencies above, you can build the TypeScript packages from source:

```bash
# Install dependencies
pnpm install-deps

# Build all packages
pnpm build

# Alternatively, build individual packages
pnpm build:crypto      # Build shielder-sdk-crypto
pnpm build:crypto-wasm # Build shielder-sdk-crypto-wasm
pnpm build:sdk         # Build shielder-sdk
```

## Development Workflow

The SDK provides several commands for development:

```bash
# Run linting on all packages
pnpm lint

# Run unit tests
pnpm test

# Build packages for e2e testing
pnpm build-package:tests
```

## End-to-End Testing

To run end-to-end tests, ensure you have:

1. Compiled all packages (`pnpm build`)
2. Docker enabled on your system

Then run:

```bash
# Navigate to the monorepo root
cd ..

# Run the E2E test script
./tooling-e2e-tests/ts_sdk_tests.sh
```

This will set up a local environment with:

- An Anvil Ethereum node
- A `shielder-relayer` container
- Test accounts and contracts

## Additional Resources

For more information about the Shielder, visit official protocol documentation: [link](https://docs.alephzero.org/aleph-zero/protocol-details/shielder)
