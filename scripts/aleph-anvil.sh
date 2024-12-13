#!/usr/bin/env bash

# This script is used to start the Anvil service configured to be as close as possible to the production environment.
#
# This script also accepts env variables instead of arguments. All arguments are optional.
#
# You need to have installed following prerequisites in order to use that script:
#   * jq
#   * foundry suite (forge, anvil)
#

set -euo pipefail

function error() {
    echo [ERROR] $*
    exit 1
}

# ============================ Argument parsing and usage ==============================================================

PORT=${PORT:-8545}
CODE_SIZE_LIMIT=${CODE_SIZE_LIMIT:-96000}

function usage(){
  cat << EOF
Usage:
   $0
    [-p|--port PORT]
      Port to run the Anvil service on. Default is 8545. Can also be set with the PORT env variable.
    [--code-size-limit CODE_SIZE_LIMIT]
      Maximum code size limit for the Anvil service. Default is 96kb. Can also be set with the CODE_SIZE_LIMIT env variable.
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--port)
      PORT="$2"
      shift;shift
      ;;
    --code-size-limit)
      CODE_SIZE_LIMIT="$2"
      shift;shift
      ;;
    *)
      error "Unrecognized argument $1!"
      ;;
  esac
done

if ss -tuln | grep -q ":${PORT} "; then
    error "Port ${PORT} is occupied."
fi

# ============================ Check required tools ====================================================================

for cmd in jq forge anvil; do
    if ! command -v "$cmd" &> /dev/null; then
        error "$cmd could not be found on PATH!"
    fi
done

# ============================ Current directory =======================================================================

script_path="${BASH_SOURCE[0]}"
script_dir=$(dirname "${script_path}")
root_dir=$(realpath "${script_dir}/..")
pushd "${root_dir}" > /dev/null

# ============================ Prepare Arbitrum precompiles ============================================================

forge build contracts/ArbSysMock.sol > /dev/null
ARB_SYS_BYTECODE=$(jq '.deployedBytecode.object' artifacts/ArbSysMock.sol/ArbSysMock.json)
echo "Arbitrum precompiles prepared"

# ============================ Start Anvil service =====================================================================

anvil --port "${PORT}" --code-size-limit "${CODE_SIZE_LIMIT}" > /dev/null &
sleep 0.5 # Wait for Anvil to start
echo "Anvil service started on port ${PORT}"

# ============================ Deploy Arbitrum precompiles =============================================================

cast rpc --rpc-url "127.0.0.1:${PORT}" anvil_setCode 0x0000000000000000000000000000000000000064 ${ARB_SYS_BYTECODE} \
  > /dev/null
echo "Precompiles deployed"

# ============================ Cleanup =================================================================================

popd > /dev/null
