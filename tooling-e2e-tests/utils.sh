####################################################################################################
#### LOGGING #######################################################################################
####################################################################################################
get_timestamp() {
  date +'%Y-%m-%d %H:%M:%S'
}

log_progress() {
  if [[ -z "${NO_FORMATTING:-}" ]]; then
    bold=$(tput bold)
    normal=$(tput sgr0)
    echo "[$(get_timestamp)] ${bold}${1}${normal}" | tee -a output.log
  else
    echo "[$(get_timestamp)] ${1}" | tee -a output.logtsk
  fi
}

####################################################################################################
#### NODE ##########################################################################################
####################################################################################################
stop_node() {
  anvil_pid=$(pgrep -f 'anvil' || true)
  if [ -n "$anvil_pid" ]; then
    kill "${anvil_pid}"
    log_progress "✅ Stopped running anvil node"
  fi
}

start_node() {
  stop_node
  ./scripts/aleph-anvil.sh --port "${NODE_RPC_PORT}" &>> output.log
  sleep 0.5 # Wait for the node to start, sometimes `curl` connects too fast.

  log_progress "✅ Anvil node started"
}

####################################################################################################
#### ACCOUNTS ######################################################################################
####################################################################################################
endow_accounts() {
  AMOUNT=$(mtzero 100000)

  keys=("${ALICE_PUBLIC_KEY}" "${BOB_PUBLIC_KEY}" "${CHARLIE_PUBLIC_KEY}" "${RELAYER_SIGNER_ADDRESSES[@]}")
  for key in "${keys[@]}"; do
    curl "${NODE_RPC_URL}" -X POST -H "Content-Type: application/json" \
      --data '{"method":"anvil_setBalance","params":["'"${key}"'", "'${AMOUNT}'"],"id":1,"jsonrpc":"2.0"}' \
      &>> output.log
  done

  log_progress "✅ Accounts endowed"
}

mtzero() {
  echo "${1}000000000000000"
}

####################################################################################################
#### CONTRACTS #####################################################################################
####################################################################################################
deploy_contracts() {
  SHIELDER_CONTRACT_ADDRESS=$(
    PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY}" forge script DeployShielderScript \
      --rpc-url "${NODE_RPC_URL}" \
      --broadcast \
      --non-interactive \
      2> /dev/null \
    | grep 'Shielder deployed at:' | awk '{print $NF}')
  export SHIELDER_CONTRACT_ADDRESS

  log_progress "✅ Contracts deployed"
}

####################################################################################################
#### RELAYER #######################################################################################
####################################################################################################
start_relayer() {
  cd "${ROOT_DIR}/crates/shielder-relayer/"
  make run &>> output.log
  cd "${ROOT_DIR}"

  log_progress "✅ Relayer started"
}

stop_relayer() {
  cd "${ROOT_DIR}/crates/shielder-relayer/"
  make stop &>> output.log
  cd "${ROOT_DIR}"

  log_progress "✅ Relayer stopped"
}

####################################################################################################
#### CLI ###########################################################################################
####################################################################################################
build_cli() {
  cargo build --release -p shielder-cli &>> output.log

  log_progress "✅ CLI built"
}

alice() {
  RUST_LOG=warning target/release/shielder-cli --no-password  --state-file ${ALICE_STATE_FILE} "$@"
}

bob() {
  RUST_LOG=warning target/release/shielder-cli --no-password --state-file ${BOB_STATE_FILE} "$@"
}

charlie() {
  RUST_LOG=warning target/release/shielder-cli --no-password --state-file ${CHARLIE_STATE_FILE} "$@"
}

clear_local_cli_state() {
  rm -f ${ALICE_STATE_FILE} ${BOB_STATE_FILE} ${CHARLIE_STATE_FILE}
  rm -rf ~/shielder-cli/

  log_progress "✅ Local CLI states cleared (state files and proving keys)"
}

configure_cli() {
  ${1} initialize ${2}
  ${1} node-url "${NODE_RPC_URL}"
  ${1} contract-address "${SHIELDER_CONTRACT_ADDRESS}"
  ${1} relayer-url "${RELAYER_URL}"
  ${1} relayer-address "${FEE_DESTINATION}"

  log_progress "✅ CLI fully configured"
}

####################################################################################################
#### SETUP & CLEANUP ###############################################################################
####################################################################################################
setup() {
  if [[ ! -n "${TESTNET:-}" ]]; then
    start_node
    endow_accounts
  fi

  build_cli
  clear_local_cli_state

  deploy_contracts
  start_relayer
}

cleanup() {
  if [[ "$?" -ne 0 ]]; then
    echo -e "❌ Test failed. Printing output.log\n\n\n"
    cat output.log
  else
    log_progress "✅ Test successfully passed"
    log_progress "🗒 Script output saved to output.log"
  fi

  docker logs shielder-relayer > relayer-output.log
  log_progress "🗒 Relayer logs saved to relayer-output.log"
  stop_relayer

  if [[ ! -n "${TESTNET:-}" ]]; then
    stop_node
  fi
}
