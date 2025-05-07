#!/usr/bin/env bash

set -euo pipefail

CHAIN_ID=$(cast chain-id --rpc-url ${NETWORK})

RUN_LATEST_PATH="broadcast/Shielder.s.sol/${CHAIN_ID}/run-latest.json"


LIBRARIES=$(cat "$RUN_LATEST_PATH" | jq -r '.libraries | map("--libraries " + .) | join(" ")')

echo "Libraries $LIBRARIES"


jq -c '.transactions[] | select(.transactionType == "CREATE")' "$RUN_LATEST_PATH" |
while read -r tx; do
  CONTRACT_NAME=$(echo "$tx" | jq -r '.contractName')
  CONTRACT_ADDRESS=$(echo "$tx" | jq -r '.contractAddress')
  

  if [[ -z "$CONTRACT_NAME" || -z "$CONTRACT_ADDRESS" ]]; then
    echo "Skipping invalid transaction"
    continue
  fi

  echo "Verifying $CONTRACT_NAME at $CONTRACT_ADDRESS using blockscout"

  forge verify-contract \
     --rpc-url ${NETWORK} --watch \
     --skip-is-verified-check \
    --verifier blockscout --verifier-url ${BLOCKSCOUT_URL} \
    $LIBRARIES \
    "$CONTRACT_ADDRESS" \
    --guess-constructor-args

  if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
    echo "Verifying $CONTRACT_NAME at $CONTRACT_ADDRESS using etherscan"
    forge verify-contract \
        --rpc-url ${NETWORK} --watch \
        --skip-is-verified-check \
        --verifier etherscan --etherscan-api-key "$ETHERSCAN_API_KEY" \
        $LIBRARIES \
        "$CONTRACT_ADDRESS" \
        --guess-constructor-args
  fi
done

echo "Verifying libraries..."

jq -r '.libraries[]' "$RUN_LATEST_PATH" |
while IFS=":" read -r SOURCE_FILE CONTRACT_NAME CONTRACT_ADDRESS; do
  if [[ -z "$CONTRACT_NAME" || -z "$CONTRACT_ADDRESS" ]]; then
    echo "Skipping invalid library line"
    continue
  fi

  echo "Verifying library $CONTRACT_NAME at $CONTRACT_ADDRESS on blockscout"

  forge verify-contract \
     --rpc-url ${NETWORK} --watch \
     --skip-is-verified-check \
    --verifier blockscout --verifier-url ${BLOCKSCOUT_URL} \
    "$CONTRACT_ADDRESS" \
    --constructor-args "0x"

  if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
    echo "Verifying library $CONTRACT_NAME at $CONTRACT_ADDRESS on etherscan"
    forge verify-contract \
        --rpc-url ${NETWORK} --watch \
        --skip-is-verified-check \
        --verifier etherscan --etherscan-api-key "$ETHERSCAN_API_KEY" \
        "$CONTRACT_ADDRESS" \
        --constructor-args "0x"
  fi
done
