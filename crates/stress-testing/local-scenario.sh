#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/../.."

source "${ROOT_DIR}/tooling-e2e-tests/local_env.sh"
source "${ROOT_DIR}/tooling-e2e-tests/utils.sh"

run() {
  pushd $ROOT_DIR &>> output.log

  start_node
  deploy_contracts
  start_relayer
  endow_accounts # only needed for relayer

  ${ROOT_DIR}/target/release/stress-testing \
    --master-seed "${DEPLOYER_PRIVATE_KEY}" \
    --node-rpc-url "${NODE_RPC_URL}" \
    --shielder "${SHIELDER_CONTRACT_ADDRESS}" \
    --relayer-url "${RELAYER_URL}/relay" \
    --relayer-address "${FEE_DESTINATION}" \
    --actor-count 10

  popd &>> output.log
}

trap cleanup EXIT SIGINT SIGTERM
rm -rf output.log
run
