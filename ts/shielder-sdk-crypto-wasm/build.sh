#!/usr/bin/env bash

set -euo pipefail

# Build regular version
tsc --project tsconfig.json
tsc-alias -p tsconfig.json

# bundle shielder-wasm and update imports
mkdir -p dist/crates/shielder-wasm/
cp -r ../../crates/shielder-wasm/pkg dist/crates/shielder-wasm/
node update-imports.mjs

# Create Vite-specific build
./patches/vite-patch.sh

