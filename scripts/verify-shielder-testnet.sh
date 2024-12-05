#!/usr/bin/env bash

set -euo pipefail

LIBRARIES=$(cat broadcast/Shielder.s.sol/2039/run-latest.json | jq ".libraries | flatten[]")
CONTRACT_ADDRESS=$(cat broadcast/Shielder.s.sol/2039/run-latest.json \
    | jq -r '.transactions | .[] | select(.contractName=="Shielder") | .contractAddress')

echo ${CONTRACT_ADDRESS} > shielder_address.txt

forge verify-contract --rpc-url https://rpc.alephzero-testnet.gelato.digital \
    --verifier blockscout --verifier-url https://evm-explorer-testnet.alephzero.org/api \
    --libraries ${LIBRARIES} \
    ${CONTRACT_ADDRESS} \
    contracts/Shielder.sol:Shielder
