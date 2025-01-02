#!/usr/bin/env bash

# NOTE: You should use `run` target from `Makefile` instead of this script.

set -u

# The following environment variables are required to run the Relayer service. Other configuration parameters
# have their default fallback values.
REQUIRED_RUN_VARS=(
    "NODE_RPC_URL"
    "FEE_DESTINATION_KEY"
    "RELAYER_SIGNING_KEYS"
    "SHIELDER_CONTRACT_ADDRESS"
    "RELAYER_DOCKER_IMAGE"
    "RELAYER_CONTAINER_NAME"
    "DOCKER_USER"
)

for var in "${REQUIRED_RUN_VARS[@]}"; do
  if [ -z "${!var+set}" ]; then
    echo "Error: Environment variable $var is not set."
    exit 1
  fi
done

ARGS=(
  -u "${DOCKER_USER}"
  --name="${RELAYER_CONTAINER_NAME}"
  -e RUST_LOG=info
  -e NODE_RPC_URL="${NODE_RPC_URL}"
  -e FEE_DESTINATION_KEY="${FEE_DESTINATION_KEY}"
  -e RELAYER_SIGNING_KEYS="${RELAYER_SIGNING_KEYS}"
  -e SHIELDER_CONTRACT_ADDRESS="${SHIELDER_CONTRACT_ADDRESS}"
)

# Add network args based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  ARGS+=(-p "${RELAYER_PORT}:${RELAYER_PORT}")
else
  # Linux
  ARGS+=(--network host)
fi

if [[ -n "${RELAYER_PORT:-}" ]]; then
  ARGS+=(-e RELAYER_PORT="${RELAYER_PORT}")
fi
if [[ -n "${DRY_RUNNING:-}" ]]; then
  ARGS+=(-e DRY_RUNNING="${DRY_RUNNING}")
fi
if [[ -n "${NONCE_POLICY:-}" ]]; then
  ARGS+=(-e NONCE_POLICY="${NONCE_POLICY}")
fi
if [[ -n "${RELAY_COUNT_FOR_RECHARGE:-}" ]]; then
  ARGS+=(-e RELAY_COUNT_FOR_RECHARGE="${RELAY_COUNT_FOR_RECHARGE}")
fi
if [[ -n "${BALANCE_MONITOR_INTERVAL_SECS:-}" ]]; then
  ARGS+=(-e BALANCE_MONITOR_INTERVAL_SECS="${BALANCE_MONITOR_INTERVAL_SECS}")
fi
if [[ -n "${TOTAL_FEE:-}" ]]; then
  ARGS+=(-e TOTAL_FEE="${TOTAL_FEE}")
fi
if [[ -n "${RELAY_GAS:-}" ]]; then
  ARGS+=(-e RELAY_GAS="${RELAY_GAS}")
fi

docker run --rm -d "${ARGS[@]}" "${RELAYER_DOCKER_IMAGE}"
