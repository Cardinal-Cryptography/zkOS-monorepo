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

check_balances() {
  alice_account=$(alice display-account)
  if ! echo "${alice_account}" | grep -q "shielded_amount: 8000000000000000,"; then # 210 deposited, 2 withdrawn, 200 in fees
      echo "❌ Alice has wrong shielded amount"
      exit 1
  fi

  bob_account=$(bob display-account)
  if ! echo "${bob_account}" | grep -q "shielded_amount: 216000000000000000,"; then # 420 deposited, 4 withdrawn, 200 in fees
      echo "❌ Bob has wrong shielded amount"
      exit 1
  fi

  charlie_account=$(charlie display-account)
  if ! echo "${charlie_account}" | grep -q "shielded_amount: 424000000000000000,"; then # 630 deposited, 6 withdrawn, 200 in fees
      echo "❌ Charlie has wrong shielded amount"
      exit 1
  fi

  log_progress "✅ Accounts have the expected balances"
}

scenario() {
  configure_cli alice ${ALICE_PRIVATE_KEY}
  configure_cli bob ${BOB_PRIVATE_KEY}
  configure_cli charlie ${CHARLIE_PRIVATE_KEY}

  withdrawal_balance_before=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")

  alice new-account $(mtzero 100)
  bob new-account $(mtzero 200)

  alice deposit $(mtzero 100)
  bob deposit $(mtzero 200)
  alice deposit $(mtzero 10)
  bob deposit $(mtzero 20)

  alice withdraw $(mtzero 1) "${WITHDRAWAL_PUBLIC_KEY}"
  bob withdraw $(mtzero 2) "${WITHDRAWAL_PUBLIC_KEY}"
  alice withdraw $(mtzero 1) "${WITHDRAWAL_PUBLIC_KEY}"
  bob withdraw $(mtzero 2) "${WITHDRAWAL_PUBLIC_KEY}"

  log_progress "✅ Some actions were made, alternating between Alice and Bob"

  charlie new-account $(mtzero 300)
  charlie deposit $(mtzero 300)
  charlie deposit $(mtzero 30)
  charlie withdraw $(mtzero 3) "${WITHDRAWAL_PUBLIC_KEY}"
  charlie withdraw $(mtzero 3) "${WITHDRAWAL_PUBLIC_KEY}"

  log_progress "✅ Charlie joined the party"

  withdrawal_balance_after=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")
  withdrawal_amount=$(echo "$withdrawal_balance_after - $withdrawal_balance_before" | bc)

  if [[ $withdrawal_amount == $(mtzero 12) ]]; then
    log_progress "✅ Withdrawals were successful - 444 mTZERO increase"
  else
    log_progress "❌ Some withdrawals failed: expected 444 mTZERO increase, got ${withdrawal_amount}"
    exit 1
  fi

  check_balances
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
