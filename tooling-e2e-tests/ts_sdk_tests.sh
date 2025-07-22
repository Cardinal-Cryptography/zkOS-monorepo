#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/.."

# Default to multi-threaded if not specified
THREADING=${THREADING:-"mt"}
# Default PLAYWRIGHT_SHARDS to empty string if not set
PLAYWRIGHT_SHARDS=${PLAYWRIGHT_SHARDS:-""}

if [[ -n "${TESTNET:-}" ]]; then
  source "${SCRIPT_DIR}/testnet_env.sh"
else
  source "${SCRIPT_DIR}/local_env.sh"
fi
source "${SCRIPT_DIR}/utils.sh"

scenario() {
  cd "${ROOT_DIR}/ts/shielder-sdk-tests"

  # Set config based on threading mode
  if [[ "${THREADING}" == "st" ]]; then
    PLAYWRIGHT_CONFIG="playwright.singlethreaded.config.mjs"
    log_progress "🔄 Running in single-threaded mode"
  else
    PLAYWRIGHT_CONFIG="playwright.multithreaded.config.mjs"
    log_progress "🔄 Running in multi-threaded mode"
  fi

  SHIELDER_CONTRACT_ADDRESS=${SHIELDER_CONTRACT_ADDRESS} \
  RPC_HTTP_ENDPOINT=${NODE_RPC_URL} \
  CHAIN_ID=${CHAIN_ID} \
  RELAYER_URL=${RELAYER_URL} \
  TESTNET_PRIVATE_KEY=${TS_SDK_PRIVATE_KEY} \
  TOKEN_CONTRACT_ADDRESSES=${TOKEN_CONTRACT_ADDRESSES} \
  CRYPTO_CLIENT_TYPE=${CRYPTO_CLIENT_TYPE:-"wasm-full"} \
  PROVER_SERVER_URL=${PROVER_SERVER_URL:-""} \
  CHECK_NITRO_ATTESTATION=${CHECK_NITRO_ATTESTATION:-"false"} \
   pnpm playwright test --config ${PLAYWRIGHT_CONFIG} ${PLAYWRIGHT_SHARDS}

  cd "${ROOT_DIR}"
  log_progress "✅ Success"
}

run() {
  pushd $SCRIPT_DIR/.. &>> output.log

  setup_shielder_sdk
  scenario

  log_progress "ℹ️ Scenario with non-zero protocol fees"
  log_progress "ℹ️ Setting non-zero protocol fees..."
  PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY}" \
  PROTOCOL_DEPOSIT_FEE_BPS=25 \
  PROTOCOL_WITHDRAW_FEE_BPS=10 \
  forge script SetProtocolFeesShielderScript --broadcast --rpc-url ${NODE_RPC_URL} --sender $(cast wallet address ${DEPLOYER_PRIVATE_KEY})
  log_progress "✅ Non-zero protocol fees set!"

  scenario

  popd &>> output.log
}

trap cleanup EXIT SIGINT SIGTERM
rm -rf output.log
run
