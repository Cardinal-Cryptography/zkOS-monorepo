#!/usr/bin/env bash

set -euo pipefail

tsc --project tsconfig.json
tsc-alias -p tsconfig.json

# bundle shielder-wasm and update imports
mkdir -p dist/crates/shielder-wasm/
cp -r ../../crates/shielder-wasm/pkg dist/crates/shielder-wasm/
node update-imports.mjs
