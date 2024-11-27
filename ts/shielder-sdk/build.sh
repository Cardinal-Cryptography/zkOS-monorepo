#!/usr/bin/env bash

set -euo pipefail

mkdir -p src/_generated
echo "export const abi =" > src/_generated/abi.ts
cat ../../artifacts/Shielder.sol/Shielder.json | jq '.abi' >> src/_generated/abi.ts
truncate -s -1 src/_generated/abi.ts
echo -n "as const;" >> src/_generated/abi.ts

tsc --project tsconfig.json
tsc-alias -p tsconfig.json

# bundle shielder-wasm and update imports
mkdir -p dist/crates/shielder-wasm/
cp -r ../../crates/shielder-wasm/pkg dist/crates/shielder-wasm/
node update-imports.mjs