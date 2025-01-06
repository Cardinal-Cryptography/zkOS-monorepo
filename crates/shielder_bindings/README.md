# `shielder-wasm`

This crates provides WASM bindings for the circuits from `shielder-circuits` crate and for some parts of `shielder-rust-sdk`.

We use the `wasm-pack` tool to generate the bindings. You can find the generated bindings in the `pkg` directory.

To build the project, run:

```bash
make
```

Inspect the `Makefile` and the resulting `pkg` directory for more information.
