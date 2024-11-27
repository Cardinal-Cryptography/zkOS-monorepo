[![LOGO][logo]][aleph-homepage]

[![Test suite][tests-badge]][tests]
[![Nightly Testnet E2E tests][nightly-tests-badge]][nightly-tests]

# Shielder: A First Iteration of zkOS

Welcome to Shielder, the first iteration of zkOS by Aleph Zero.
Shielder is designed to provide a seamless integration of zero-knowledge (ZK) privacy into Ethereum Virtual Machine (EVM) compatible environments with subsecond proving times.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Usage](#usage)
- [License](#license)

## Introduction

Shielder is part of the Aleph Zero zkOS initiative, aimed at delivering Privacy-as-a-Service for Web3. With zkOS, developers can integrate ZK-based privacy into their applications without deep cryptographic knowledge.

## Features

- **EVM Compatibility**: Easily integrate with existing Ethereum-based applications.
- **Subsecond Proving**: Achieve zero-knowledge proofs in 600-800 ms on standard hardware.
- **High Performance**: Supports up to 250ms block time and processes thousands of transactions per second.
- **Developer-Friendly**: Comprehensive tooling and frameworks to simplify integration.
- **Privacy-Enhanced**: Build and deploy privacy-enhanced applications effortlessly.

# Architecture

Shielder is built utilizing the following components:

- **Aleph Zero WASM L1**: Serves as the Data Availability layer.
- **EVM Layer 2 Rollup**: Leverages Arbitrum Anytrust DAC technology for fast and secure execution.
- **Developer Tooling**: Includes Gelato’s web3 services, account abstraction, functions, VRF, oracles, block explorers, indexers, and multisig support.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following:

- Node.js and npm installed
- Docker (optional, for containerized deployment)
- An Ethereum wallet

### Usage

Clone the repository and install the dependencies:

```bash
git clone git@github.com:Cardinal-Cryptography/zkOS.git
cd zkOS
make deps
```

Boot a local node:

```bash
make anvil
```

Compile & deploy the smart contract suite:

```bash
make deploy-contracts
```

### Deploying to anvil

The command below will use `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` as a deployer:

```bash
NETWORK=anvil make deploy-contracts
```

## License

Shielder is licensed under the MIT License. See the LICENSE file for more details.

[aleph-homepage]: https://alephzero.org
[logo]: logo.png
[tests]: https://github.com/Cardinal-Cryptography/zkOS-monorepo/actions/workflows/on-master-branch-push-pull_request.yml
[tests-badge]: https://github.com/Cardinal-Cryptography/zkOS-monorepo/actions/workflows/on-master-branch-push-pull_request.yml/badge.svg
[nightly-tests]: https://github.com/Cardinal-Cryptography/zkOS-monorepo/actions/workflows/nightly-testnet-e2e.yml
[nightly-tests-badge]: https://github.com/Cardinal-Cryptography/zkOS-monorepo/actions/workflows/nightly-testnet-e2e.yml/badge.svg
