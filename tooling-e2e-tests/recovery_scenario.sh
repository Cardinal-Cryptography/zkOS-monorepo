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

config_cli_for_recovery() {
  alice initialize "${ALICE_PRIVATE_KEY}"
  alice node-url "${NODE_RPC_URL}"
  alice contract-address "${SHIELDER_CONTRACT_ADDRESS}"

  log_progress "✅ CLI minimally configured for recovery process"
}

make_history() {
  configure_cli alice ${ALICE_PRIVATE_KEY}

  # 1. Native token
  alice new-account $(mtzero 500) # so that we have enough balance for withdrawals
  alice deposit $(mtzero 6)
  alice withdraw $(mtzero 7) "${WITHDRAWAL_PUBLIC_KEY}"
  alice deposit $(mtzero 8)
  alice withdraw $(mtzero 9) "${WITHDRAWAL_PUBLIC_KEY}"

  # 2. ERC20 token
  alice new-account-erc20 $(mtzero 500) "${ERC20_CONTRACT_ADDRESS_1}" # so that we have enough balance for withdrawals
  alice deposit-erc20 $(mtzero 6) "${ERC20_CONTRACT_ADDRESS_1}"
  alice withdraw-erc20 $(mtzero 7) "${WITHDRAWAL_PUBLIC_KEY}" "${ERC20_CONTRACT_ADDRESS_1}" $(mtzero 1)
  alice deposit-erc20 $(mtzero 8) "${ERC20_CONTRACT_ADDRESS_1}"
  alice withdraw-erc20 $(mtzero 9) "${WITHDRAWAL_PUBLIC_KEY}" "${ERC20_CONTRACT_ADDRESS_1}" $(mtzero 1)

  log_progress "✅ Some deposits and withdrawals made"
}

# Scenario:
# 1. Start with clean state
# 2. Make some shielder operations
# 3. Lose the state
# 4. Recover the state
# 5. Check that the state is correct
scenario() {
  make_history

  account_snapshot=$(alice display-account)
  history_snapshot=$(alice history)

  clear_local_cli_state
  log_progress "✅ State lost"

  config_cli_for_recovery

  alice recover-state "native"
  alice recover-state "${ERC20_CONTRACT_ADDRESS_1}"

  account_now=$(alice display-account)
  history_now=$(alice history)

  if [ "$account_snapshot" != "$account_now" ]; then
    log_progress "❌ Account state mismatch"
    exit 1
  fi
  if [ "$history_snapshot" != "$history_now" ]; then
    log_progress "❌ History state mismatch"
    exit 1
  fi

  log_progress "✅ State recovered successfully"
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
