#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/../.."

# ==================================================================================================================== #
#                                                     ENVIRONMENT                                                      #
# ==================================================================================================================== #

# ======================== Relayer configuration ========================

NODE_RPC_URL="https://rpc.alephzero-testnet.gelato.digital"
export NODE_RPC_URL

RELAYER_PORT=4141
export RELAYER_PORT
RELAYER_URL="http://localhost:${RELAYER_PORT}"
export RELAYER_URL

NONCE_POLICY=caching
export NONCE_POLICY
DRY_RUNNING=optimistic
export DRY_RUNNING
RELAY_COUNT_FOR_RECHARGE=10
export RELAY_COUNT_FOR_RECHARGE

# ======================== Accounts ========================
DEPLOYER_PRIVATE_KEY=
export DEPLOYER_PRIVATE_KEY

FEE_DESTINATION_KEY=
export FEE_DESTINATION_KEY
FEE_DESTINATION=
export FEE_DESTINATION

RELAYER_SIGNING_KEYS=
export RELAYER_SIGNING_KEYS

# ==================================================================================================================== #
#                                                     SCENARIO                                                         #
# ==================================================================================================================== #

source "${ROOT_DIR}/tooling-e2e-tests/utils.sh"

run() {
  pushd $ROOT_DIR &>> output.log

  deploy_contracts
  start_relayer

  ${ROOT_DIR}/target/release/stress-testing \
    --master-seed "${DEPLOYER_PRIVATE_KEY}" \
    --node-rpc-url "${NODE_RPC_URL}" \
    --shielder "${SHIELDER_CONTRACT_ADDRESS}" \
    --relayer-url "${RELAYER_URL}" \
    --relayer-address "${FEE_DESTINATION}" \
    --actor-count 12

  popd &>> output.log
}

trap cleanup EXIT SIGINT SIGTERM
rm -rf output.log
run
