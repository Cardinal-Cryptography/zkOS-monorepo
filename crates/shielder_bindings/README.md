# Shielder Bindings

Platform-native bindings for the Shielder cryptographic operations, supporting both WebAssembly (WASM) and mobile platforms through a unified Rust codebase.

## Overview

The shielder_bindings crate provides a no_std compatible interface to the Shielder cryptographic operations. It supports multiple compilation targets including WebAssembly for browser environments and platform-native bindings (via UniFFI) for mobile platforms.

## Building

### Prerequisites

- Rust toolchain (see rust-toolchain.toml)
- wasm-pack (for WebAssembly builds)
- Rust target: aarch64-apple-ios-sim (for iOS simulator builds)

### WebAssembly Builds

```bash
# Build both single-threaded and multi-threaded WASM packages
make wasm

# This will:
# 1. Clean previous builds
# 2. Build single-threaded package
# 3. Build multi-threaded package with rayon support
# 4. Update package configuration
```

The WASM build process creates package `pkg/` with two exports:

- `pkg-web-singlethreaded`: Standard WASM build
- `pkg-web-multithreaded`: WASM build with rayon-powered multithreading

### WebAssembly Build without circuits

If you want to build a light-weight WASM without proving functionality, you should use

```
make wasm-without-circuits
```

This will build package `pkg-without-circuits` with one export:

- `pkg-web-singlethreaded`: Standard WASM build

### iOS Builds

```bash
# Generate iOS bindings
make ios

# This will:
# 1. Build for aarch64-apple-ios-sim target
# 2. Generate Swift bindings using UniFFI
# 3. Output bindings to ios-bindings directory
```
