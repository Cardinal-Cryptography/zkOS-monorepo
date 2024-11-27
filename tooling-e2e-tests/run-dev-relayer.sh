#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/.."

source "${SCRIPT_DIR}/env.sh"
source "${SCRIPT_DIR}/utils.sh"

trap cleanup EXIT SIGINT SIGTERM

setup

docker logs shielder-relayer -f