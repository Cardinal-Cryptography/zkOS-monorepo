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
  log_progress "✅ Native account created and deposited to it"

  alice new-account-erc20 $(mtzero 200) "${ERC20_CONTRACT_ADDRESS_1}"
  alice deposit-erc20 $(mtzero 100) "${ERC20_CONTRACT_ADDRESS_1}"
  log_progress "✅ ERC20 account created and deposited to it"

  alice display-account
  alice history

  withdrawal_amount=$(mtzero 50)

  # Native withdrawal
  withdrawal_balance_before=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")
  alice withdraw $withdrawal_amount "${WITHDRAWAL_PUBLIC_KEY}"
  withdrawal_balance_after=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")

  withdrawn=$((withdrawal_balance_after - withdrawal_balance_before))
  if [ $withdrawn -ne $withdrawal_amount ]; then
    log_progress "❌ Native withdrawal failed: expected ${withdrawal_amount} increase, got ${withdrawn}"
    exit 1
  else
    log_progress "✅ Native withdrawal successful"
  fi

  # ERC20 withdrawal
  withdrawal_balance_before=$(erc20_balance "${ERC20_CONTRACT_ADDRESS_1}" "${WITHDRAWAL_PUBLIC_KEY}")
  alice withdraw-erc20 $withdrawal_amount "${WITHDRAWAL_PUBLIC_KEY}" "${ERC20_CONTRACT_ADDRESS_1}" 18
  withdrawal_balance_after=$(erc20_balance "${ERC20_CONTRACT_ADDRESS_1}" "${WITHDRAWAL_PUBLIC_KEY}")

  withdrawn=$((withdrawal_balance_after - withdrawal_balance_before))
  if [ $withdrawn -ne $withdrawal_amount ]; then
    log_progress "❌ ERC20 withdrawal failed: expected ${withdrawal_amount} token increase, got ${withdrawn}"
    exit 1
  else
    log_progress "✅ ERC20 withdrawal successful"
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
