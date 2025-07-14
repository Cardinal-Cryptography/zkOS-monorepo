# Memo Scan

A command-line tool for scanning blockchain events and extracting memo data from Shielder contract transactions.

## Overview

This tool scans blockchain blocks to find referral data embedded in memo fields of Shielder contract events (`NewAccount`, `Deposit`, and `Withdraw`). It automatically detects contract deployment blocks and supports batch processing for efficient scanning.

## Features

- **Archival Node Detection**: Automatically checks if the RPC provider is an archival node
- **Contract Deployment Detection**: Finds the deployment block of the target contract
- **Batch Processing**: Processes blocks in configurable batches for optimal performance
- **Multi-Event Support**: Extracts memos from `NewAccount`, `Deposit`, and `Withdraw` events
- **Flexible Block Range**: Scan specific block ranges or entire contract history

## Usage

```bash
cargo run -- \
  --contract-address 0x5A0dea46A96a5b578c9cf1730f461eD0bC9C32c6 \
  --rpc-url "https://arb1.lava.build"
```
Note that the above will return 0 results, because this is the old version of the contract without memos.


### Arguments

- `--contract-address`: Shielder contract address (hex format)
- `--rpc-url`: Blockchain RPC endpoint URL
- `--start-block` (optional): Starting block number (defaults to contract deployment block)
- `--stop-block` (optional): Ending block number (defaults to latest block)

### Examples

**Scan entire contract history:**
```bash
cargo run -- \
  --contract-address 0x5A0dea46A96a5b578c9cf1730f461eD0bC9C32c6 \
  --rpc-url http://localhost:8545
```

**Scan specific block range:**
```bash
cargo run -- \
  --contract-address 0x5A0dea46A96a5b578c9cf1730f461eD0bC9C32c6 \
  --rpc-url http://localhost:8545 \
  --start-block 1000000 \
  --stop-block 1010000
```

## Requirements

- **Archival Node**: The RPC provider must be an archival node to determine contract deployment blocks
- **Supported Networks**: 
  - Ethereum Mainnet (Chain ID: 1)
  - Arbitrum One (Chain ID: 42161)  
  - Base (Chain ID: 8453)

## Output

The tool outputs:
- Contract deployment block number
- Current blockchain height
- Progress updates during scanning
- Total number of referrals found

Each referral contains:
- Block number
- Transaction hash
- Memo data (as bytes)

## Error Handling

- Validates contract address format
- Checks for archival node capability
- Ensures block ranges are valid
- Handles RPC connection errors