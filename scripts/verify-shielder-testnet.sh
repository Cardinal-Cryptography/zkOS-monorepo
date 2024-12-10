#!/usr/bin/env bash

set -euo pipefail

LIBRARIES=$(cat broadcast/Shielder.s.sol/2039/run-latest.json | jq -r '.libraries | map("--libraries " + .) | join(" ")')
IMPL_CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq -r '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="Shielder") | .contractAddress')
PROXY_CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq -r '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="ERC1967Proxy") | .contractAddress')
PROXY_DEPLOYMENT_TX_HASH=$(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="ERC1967Proxy") | .hash')
PROXY_BLOCK_NUMBER=$(cast to-dec $(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq -r ".receipts | .[] | select(.transactionHash==${PROXY_DEPLOYMENT_TX_HASH}) | .blockNumber"))

echo ${PROXY_CONTRACT_ADDRESS} > shielder_address.txt
echo ${PROXY_BLOCK_NUMBER} > shielder_block_number.txt

forge verify-contract --rpc-url https://rpc.alephzero-testnet.gelato.digital \
    --verifier blockscout --verifier-url https://evm-explorer-testnet.alephzero.org/api \
    ${LIBRARIES} \
    ${IMPL_CONTRACT_ADDRESS} \
    contracts/Shielder.sol:Shielder
