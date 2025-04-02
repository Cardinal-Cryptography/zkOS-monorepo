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
    "TOKEN_CONFIG"
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
  -e TOKEN_CONFIG="${TOKEN_CONFIG}"
)

# Add network args based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  ARGS+=(-p "${RELAYER_PORT}:${RELAYER_PORT}")
else
  # Linux
  ARGS+=(--network host)
fi

if [[ -n "${LOGGING_FORMAT:-}" ]]; then
  ARGS+=(-e LOGGING_FORMAT="${LOGGING_FORMAT}")
fi
if [[ -n "${RELAYER_HOST:-}" ]]; then
  ARGS+=(-e RELAYER_HOST="${RELAYER_HOST}")
fi
if [[ -n "${RELAYER_PORT:-}" ]]; then
  ARGS+=(-e RELAYER_PORT="${RELAYER_PORT}")
fi
if [[ -n "${RELAYER_METRICS_PORT:-}" ]]; then
  ARGS+=(-e RELAYER_METRICS_PORT="${RELAYER_METRICS_PORT}")
fi

if [[ -n "${RELAY_GAS:-}" ]]; then
  ARGS+=(-e RELAY_GAS="${RELAY_GAS}")
fi
if [[ -n "${BALANCE_MONITOR_INTERVAL:-}" ]]; then
  ARGS+=(-e BALANCE_MONITOR_INTERVAL="${BALANCE_MONITOR_INTERVAL}")
fi
if [[ -n "${NONCE_POLICY:-}" ]]; then
  ARGS+=(-e NONCE_POLICY="${NONCE_POLICY}")
fi
if [[ -n "${DRY_RUNNING:-}" ]]; then
  ARGS+=(-e DRY_RUNNING="${DRY_RUNNING}")
fi
if [[ -n "${RECHARGE_THRESHOLD:-}" ]]; then
  ARGS+=(-e RECHARGE_THRESHOLD="${RECHARGE_THRESHOLD}")
fi

if [[ -n "${PRICE_FEED_REFRESH_INTERVAL:-}" ]]; then
  ARGS+=(-e PRICE_FEED_REFRESH_INTERVAL="${PRICE_FEED_REFRESH_INTERVAL}")
fi
if [[ -n "${PRICE_FEED_VALIDITY:-}" ]]; then
  ARGS+=(-e PRICE_FEED_VALIDITY="${PRICE_FEED_VALIDITY}")
fi
if [[ -n "${SERVICE_FEE_PERCENT:-}" ]]; then
  ARGS+=(-e SERVICE_FEE_PERCENT="${SERVICE_FEE_PERCENT}")
fi
if [[ -n "${QUOTE_VALIDITY:-}" ]]; then
  ARGS+=(-e QUOTE_VALIDITY="${QUOTE_VALIDITY}")
fi
if [[ -n "${MAX_POCKET_MONEY:-}" ]]; then
  ARGS+=(-e MAX_POCKET_MONEY="${MAX_POCKET_MONEY}")
fi

DETACHED_FLAG=""
if [[ "${DETACHED:-}" == "true" ]]; then
  DETACHED_FLAG="-d"
fi

docker run --rm ${DETACHED_FLAG} "${ARGS[@]}" "${RELAYER_DOCKER_IMAGE}"
