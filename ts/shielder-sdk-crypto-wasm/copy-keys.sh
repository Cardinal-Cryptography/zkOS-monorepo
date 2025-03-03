#!/usr/bin/env bash

set -euo pipefail

# Create dist-keys directory and subdirectories
mkdir -p dist-keys/new_account
mkdir -p dist-keys/deposit
mkdir -p dist-keys/withdraw

# Copy binary files from artifacts to dist-keys
cp ../../crates/shielder_bindings/artifacts/new_account/params.bin \
    ../../crates/shielder_bindings/artifacts/new_account/pk.bin \
    dist-keys/new_account/
cp ../../crates/shielder_bindings/artifacts/deposit/params.bin \
    ../../crates/shielder_bindings/artifacts/deposit/pk.bin \
    dist-keys/deposit/
cp ../../crates/shielder_bindings/artifacts/withdraw/params.bin \
    ../../crates/shielder_bindings/artifacts/withdraw/pk.bin \
    dist-keys/withdraw/

echo "Circuit key files copied to dist-keys directory"