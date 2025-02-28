#!/usr/bin/env bash

set -u

NODE_RPC_PORT=8545
NODE_RPC_URL="http://localhost:${NODE_RPC_PORT}"
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

########################## Start anvil #########################################

../../scripts/aleph-anvil.sh --port "${NODE_RPC_PORT}" 1> /dev/null 2>&1

########################## Deploy contracts and setup caller ###################
ACCEPTING_SHIELDER=$(forge create -r "${NODE_RPC_URL}" --private-key "${DEPLOYER_PRIVATE_KEY}" --broadcast crates/shielder-relayer/test-resources/AcceptingShielder.sol:AcceptingShielder --json | jq -r '.deployedTo')
REVERTING_SHIELDER=$(forge create -r "${NODE_RPC_URL}" --private-key "${DEPLOYER_PRIVATE_KEY}" --broadcast crates/shielder-relayer/test-resources/RevertingShielder.sol:RevertingShielder --json | jq -r '.deployedTo')

########################## Run tests ###########################################
export ACCEPTING_SHIELDER
export REVERTING_SHIELDER
export NODE_RPC_URL

cargo test --release -- --show-output --test-threads 1
TEST_RESULT=$?

########################## Stop anvil ##########################################
anvil_pid=$(pgrep -f 'anvil' || true)
if [ -n "$anvil_pid" ]; then
  kill "${anvil_pid}"
fi

########################## Exit with the same code as cargo test ###############
exit $TEST_RESULT
