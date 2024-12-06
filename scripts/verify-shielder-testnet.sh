#!/usr/bin/env bash

set -euo pipefail

LIBRARIES=$(cat broadcast/Shielder.s.sol/2039/run-latest.json | jq ".libraries | flatten[]")
IMPL_CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq -r '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="Shielder") | .contractAddress')
PROXY_CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq -r '.transactions | .[] | select(.transactionType=="CREATE") | select(.contractName=="ERC1967Proxy") | .contractAddress')

echo ${PROXY_CONTRACT_ADDRESS} > shielder_address.txt

forge verify-contract --rpc-url https://rpc.alephzero-testnet.gelato.digital \
    --verifier blockscout --verifier-url https://evm-explorer-testnet.alephzero.org/api \
    --libraries ${LIBRARIES} \
    ${IMPL_CONTRACT_ADDRESS} \
    contracts/Shielder.sol:Shielder
