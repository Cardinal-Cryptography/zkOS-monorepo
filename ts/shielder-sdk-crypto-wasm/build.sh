#!/usr/bin/env bash

set -euo pipefail

# Build regular version
tsc --project tsconfig.json
tsc-alias -p tsconfig.json

# bundle shielder_bindings and update imports
mkdir -p dist/crates/shielder_bindings/
cp -r ../../crates/shielder_bindings/pkg dist/crates/shielder_bindings/
node update-imports.mjs

# Create Vite-specific build
# ./patches/vite-patch.sh

