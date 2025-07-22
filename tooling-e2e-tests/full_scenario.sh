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

# ${1} - actor name
# ${2} - actor private key
scenario() {
  configure_cli ${1} ${2}

  log_progress "✅ CLI configured"
  ${1} app-config

  ${1} new-account $(mtzero 200)
  ${1} deposit $(mtzero 100)
  log_progress "✅ Native account created and deposited to it"

  ${1} new-account-erc20 $(mtzero 200) "${ERC20_CONTRACT_ADDRESS_1}"
  ${1} deposit-erc20 $(mtzero 100) "${ERC20_CONTRACT_ADDRESS_1}"
  log_progress "✅ ERC20 account created and deposited to it"

  ${1} display-account
  ${1} history

  withdrawal_amount=$(mtzero 50)

  #####################################################################################
  ################################# Native withdrawal #################################
  #####################################################################################
  withdrawal_balance_before=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")
  ${1} withdraw $withdrawal_amount "${WITHDRAWAL_PUBLIC_KEY}"
  withdrawal_balance_after=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")

  withdrawn=$((withdrawal_balance_after - withdrawal_balance_before))
  if [ $withdrawn -ne $withdrawal_amount ]; then
    log_progress "❌ Native withdrawal failed: expected ${withdrawal_amount} increase, got ${withdrawn}"
    exit 1
  else
    log_progress "✅ Native withdrawal successful"
  fi

  ####################################################################################
  ################################# ERC20 withdrawal #################################
  ####################################################################################
  withdrawal_balance_before=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")
  withdrawal_erc20_balance_before=$(erc20_balance "${ERC20_CONTRACT_ADDRESS_1}" "${WITHDRAWAL_PUBLIC_KEY}")
  relayer_balance_before=$(erc20_balance "${ERC20_CONTRACT_ADDRESS_1}" "${FEE_DESTINATION}")

  pocket_money=$(mtzero 1)
  ${1} withdraw-erc20 $withdrawal_amount "${WITHDRAWAL_PUBLIC_KEY}" "${ERC20_CONTRACT_ADDRESS_1}" $pocket_money

  withdrawal_balance_after=$(cast balance -r "${NODE_RPC_URL}" "${WITHDRAWAL_PUBLIC_KEY}")
  withdrawal_erc20_balance_after=$(erc20_balance "${ERC20_CONTRACT_ADDRESS_1}" "${WITHDRAWAL_PUBLIC_KEY}")
  relayer_balance_after=$(erc20_balance "${ERC20_CONTRACT_ADDRESS_1}" "${FEE_DESTINATION}")

  withdrawn_erc20=$((withdrawal_erc20_balance_after - withdrawal_erc20_balance_before))
  if [ $withdrawn -ne $withdrawal_amount ]; then
    log_progress "❌ ERC20 withdrawal failed: expected ${withdrawal_amount} token increase, got ${withdrawn_erc20}"
    exit 1
  else
    log_progress "✅ ERC20 withdrawal successful"
  fi

  pocket_money_sent=$((withdrawal_balance_after - withdrawal_balance_before))
  if [ $pocket_money_sent -ne $pocket_money ]; then
    log_progress "❌ ERC20 withdrawal failed: expected ${pocket_money} pocket money, got ${pocket_money_sent}"
    exit 1
  else
    log_progress "✅ ERC20 withdrawal pocket money successful"
  fi

  fee=$((relayer_balance_after - relayer_balance_before))
  if [ $fee -le 0 ]; then
    log_progress "❌ ERC20 withdrawal failed: expected ${withdrawal_amount} fee, got ${fee}"
    exit 1
  else
    log_progress "✅ ERC20 withdrawal fee successful"
  fi

  ${1} display-account
  ${1} history
}

run() {
  pushd $SCRIPT_DIR/.. &>> output.log

  setup
  scenario alice ${ALICE_PRIVATE_KEY}

  log_progress "ℹ️ Scenario with non-zero protocol fees"
  log_progress "ℹ️ Setting non-zero protocol fees..."
  PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY}" \
  PROTOCOL_DEPOSIT_FEE_BPS=25 \
  PROTOCOL_WITHDRAW_FEE_BPS=10 \
  forge script SetProtocolFeesShielderScript --broadcast --rpc-url ${NODE_RPC_URL} --sender $(cast wallet address ${DEPLOYER_PRIVATE_KEY})
  log_progress "✅ Non-zero protocol fees set!"

  scenario bob ${BOB_PRIVATE_KEY}

  popd &>> output.log
}

trap cleanup EXIT SIGINT SIGTERM
rm -rf output.log
run
