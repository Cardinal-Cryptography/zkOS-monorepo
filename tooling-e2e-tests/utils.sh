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

  keys=("${ALICE_PUBLIC_KEY}" "${BOB_PUBLIC_KEY}" "${CHARLIE_PUBLIC_KEY}" "${TS_SDK_PUBLIC_KEY}" "${FEE_DESTINATION}")
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
deploy_shielder_contracts() {
  SHIELDER_CONTRACT_ADDRESS=$(
    PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY}" \
    NETWORK="${NODE_RPC_URL}" \
	  ./scripts/deploy-shielder.sh \
      2> output.log \
    | grep 'Shielder deployed at:' | awk '{print $NF}')
  export SHIELDER_CONTRACT_ADDRESS

  log_progress "✅ Contracts deployed"
}

deploy_erc20_token() {
  echo $(
    forge create TestERC20 \
      --rpc-url "${NODE_RPC_URL}" \
      --private-key "${DEPLOYER_PRIVATE_KEY}" \
      --broadcast \
      --json \
      --constructor-args "${1}" "${2}" \
      2> output.log \
    | jq -r '.deployedTo'
  )
}

deploy_erc20_tokens() {
  ERC20_CONTRACT_ADDRESS_1=$(deploy_erc20_token "TestToken1" "TT1")
  export ERC20_CONTRACT_ADDRESS_1
  ERC20_CONTRACT_ADDRESS_2=$(deploy_erc20_token "TestToken2" "TT2")
  export ERC20_CONTRACT_ADDRESS_2

  TOKEN_CONTRACT_ADDRESSES=$ERC20_CONTRACT_ADDRESS_1","$ERC20_CONTRACT_ADDRESS_2
  export TOKEN_CONTRACT_ADDRESSES

  # set pricing for relayer
  TOKEN_CONFIG=$(cat <<EOF
  [
    {
      "kind":"Native",
      "price_provider":{"Static":1}
    },
    {
      "kind":{"ERC20":{"address": "${ERC20_CONTRACT_ADDRESS_1}", "decimals": 18}},
      "price_provider":{"Static":1}
    },
    {
      "kind":{"ERC20":{"address": "${ERC20_CONTRACT_ADDRESS_2}", "decimals": 18}},
      "price_provider":{"Static":1}
    }
  ]
EOF
  )
  export TOKEN_CONFIG

  log_progress "✅ Tokens deployed"
}

mint_erc20_tokens() {
  AMOUNT=$(mtzero 100000)

  keys=("${TS_SDK_PUBLIC_KEY}" "${RELAYER_SIGNER_ADDRESSES[@]}" "${ALICE_PUBLIC_KEY}" "${BOB_PUBLIC_KEY}" "${CHARLIE_PUBLIC_KEY}")

  for key in "${keys[@]}"; do
    for token in $(echo ${TOKEN_CONTRACT_ADDRESSES} | sed "s/,/ /g"); do
      cast send \
        --rpc-url "${NODE_RPC_URL}" \
        --private-key "${DEPLOYER_PRIVATE_KEY}" \
        ${token} \
        "mint(address,uint256)" \
        ${key} \
        ${AMOUNT} \
        &>> output.log
    done
  done

  log_progress "✅ Tokens minted"
}

erc20_balance() {
  full_answer=$(cast call -r "${NODE_RPC_URL}" "${1}" "balanceOf(address)(uint256)" "${2}")
  echo "${full_answer}" | awk '{print $1;}'
}

####################################################################################################
#### RELAYER #######################################################################################
####################################################################################################
start_relayer() {
  cd "${ROOT_DIR}/crates/shielder-relayer/"
  make run &>> output.log
  cd "${ROOT_DIR}"

  while true; do
     curl -s "${RELAYER_URL}/health" && break
     sleep 1
  done

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

  deploy_shielder_contracts
  deploy_erc20_tokens
  mint_erc20_tokens

  start_relayer
}

setup_shielder_sdk() {
  if [[ ! -n "${TESTNET:-}" ]]; then
    start_node
    endow_accounts
  fi

  deploy_shielder_contracts
  deploy_erc20_tokens
  mint_erc20_tokens

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

  if [[ -z "${TESTNET:-}" ]] && [[ -z "${KEEP_NODE:-}" ]]; then
    log_progress "🗒 Stopping anvil node"
    stop_node
  fi
}
