#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/.."

if [[ -n "${TESTNET:-}" ]]; then
  source "${SCRIPT_DIR}/testnet_env.sh"
else
  source "${SCRIPT_DIR}/local_env.sh"
fi
source "${SCRIPT_DIR}/utils.sh"

scenario() {
  configure_cli alice ${ALICE_PRIVATE_KEY}

  log_progress "✅ CLI configured"
  alice app-config

  alice new-account $(mtzero 200)
  alice deposit $(mtzero 100)

  alice new-account-erc20 $(mtzero 200) "${ERC20_CONTRACT_ADDRESS_1}"
  alice deposit-erc20 $(mtzero 100) "${ERC20_CONTRACT_ADDRESS_1}"

  log_progress "✅ Some deposits made"
  alice display-account
  alice history

  withdrawal_amount=$(mtzero 50)

  withdrawal_balance_before=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")
  alice withdraw $withdrawal_amount "${WITHDRAWAL_PUBLIC_KEY}"
  withdrawal_balance_after=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")

  withdrawn=$((withdrawal_balance_after - withdrawal_balance_before))
  if [ $withdrawn -ne $withdrawal_amount ]; then
    log_progress "❌ Withdrawal failed: expected 5 mTZERO increase, got ${withdrawal_amount}"
    exit 1
  else
    log_progress "✅ Withdrawal successful"
  fi

  alice display-account
  alice history
}

run() {
  pushd $SCRIPT_DIR/.. &>> output.log

  setup
  scenario

  popd &>> output.log
}

trap cleanup EXIT SIGINT SIGTERM
rm -rf output.log
run
