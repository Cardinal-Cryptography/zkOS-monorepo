#!/bin/sh

: "${PUBLIC_PORT:=3000}"
: "${TEE_PORT:=5000}"
: "${BIND_ADDRESS:=0.0.0.0}"
: "${TEE_CID:=16}"
: "${TASK_POOL_CAPACITY:=100}"
: "${MAXIMUM_REQUEST_SIZE:=102400}"
: "${TASK_POOL_TIMEOUT_SECS:=5}"
: "${TEE_COMPUTE_TIMEOUT_SECS:=60}"
: "${RUST_LOG:=info}"

CMD="/app/shielder-prover-server"
CMD="$CMD --public-port ${PUBLIC_PORT}"
CMD="$CMD --tee-port ${TEE_PORT}"
CMD="$CMD --bind-address ${BIND_ADDRESS}"
CMD="$CMD --tee-cid ${TEE_CID}"
CMD="$CMD --task-pool-capacity ${TASK_POOL_CAPACITY}"
CMD="$CMD --maximum-request-size ${MAXIMUM_REQUEST_SIZE}"
CMD="$CMD --task-pool-timeout-secs ${TASK_POOL_TIMEOUT_SECS}"
CMD="$CMD --tee-compute-timeout-secs ${TEE_COMPUTE_TIMEOUT_SECS}"

exec $CMD
