## Overview

The `tee/` subfolder contains Rust crates required to build Shielder Prover Server, a TEE-based REST server which
computes ZK-proofs:
1. The user wants to generate a proof for relation `R` with witness `w` and statement `s`
2. The user generates an asymmetric encryption key (`pub_sk`, `sk`) to get a response back from the server
3. The user queries the server for their asymmetric encryption keys (different pair than point 2.) and encrypts `ciphertext=(R, w, s, pub_sk)` 
and sends `e = Enc(ciphertext)` to the server
4. The server decrypts and unpacks the ciphertext. Then it generates the proof `π` and `pub_inputs`, and outputs `pub_sk(π)`, `pub_sk(pub_inputs)`
5. The user receives encrypted (`π`, `pub_inputs`) and decrypts it.

The proof `π` and `pub_inputs` can be then used in further part of the Shielder workflow, ie submitting the proof to the Shielder contract.

### Packages

There are three Rust crates:
* `shielder-prover-common` - contains common definitions between the `shielder-prover-server` and `shielder-prover-tee`,
* `shielder-prover-server` - a host (EC-2) part of the server. This is the server that is exposed to the Internet, and most
of its function is to forward requests to TEE and limit maximum concurrent requests amount
* `shielder-prover-tee` - main part of the Server which computes ZK-proofs, runs entirerely in TEE. Communicates with
`shielder-prover-server` via vsock

## Building

To build the enclave image of `shielder-prover-tee` (and measurements) you will need `nix` installed 
(see https://nixos.org/download/#download-nix), and then:

```bash
cd nix
nix build
```

To make sure builds are reproducible, the commit hash of `zkOS-monorepo` source is hardcoded in nix flake files. To override the commit hash, run:
```bash
cd nix
nix build --override-input zkOS-monorepo 'github:Cardinal-Cryptography/zkOS-monorepo/NEW_COMMIT_HASH_HERE'
```
