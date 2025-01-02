#!/usr/bin/env bash

set -euo pipefail

CHAIN_ID=$(cast chain-id --rpc-url ${NETWORK})

LIBRARIES=$(cat broadcast/Shielder.s.sol/${CHAIN_ID}/run-latest.json | jq -r '.libraries | map("--libraries " + .) | join(" ")')
IMPL_CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/${CHAIN_ID}/run-latest.json \
    | jq -r '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="Shielder") | .contractAddress')
PROXY_CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/${CHAIN_ID}/run-latest.json \
    | jq -r '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="ERC1967Proxy") | .contractAddress')
PROXY_DEPLOYMENT_TX_HASH=$(cat broadcast/Shielder.s.sol/${CHAIN_ID}/run-latest.json \
    | jq '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="ERC1967Proxy") | .hash')
PROXY_BLOCK_NUMBER=$(cast to-dec $(cat broadcast/Shielder.s.sol/${CHAIN_ID}/run-latest.json \
    | jq -r ".receipts | .[] | select(.transactionHash==${PROXY_DEPLOYMENT_TX_HASH}) | .blockNumber"))

echo ${PROXY_CONTRACT_ADDRESS} > shielder_address.txt
echo ${PROXY_BLOCK_NUMBER} > shielder_block_number.txt

forge verify-contract --rpc-url ${NETWORK} \
    --verifier blockscout --verifier-url ${EXPLORER_URL} \
    ${LIBRARIES} \
    ${IMPL_CONTRACT_ADDRESS} \
    contracts/Shielder.sol:Shielder
