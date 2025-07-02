## Building

To build the enclave images you will need `nix` installed (see https://nixos.org/download/#download-nix), and then:

```bash
cd nix
nix build
```

To make sure builds are reproducible, the commit hash of source is hardcoded in nix flake files. To override the commit hash, run:
```bash
cd nix
nix build --override-input zkOS-monorepo 'github:Cardinal-Cryptography/zkOS-monorepo/NEW_COMMIT_HASH_HERE'
```

## Setup

Copy (or create your own) `.env.example` to `.env`.

## Migrations

To setup the DB with no fuss, just `make migrate`. To rerun from an empty state `make migrate-fresh`.
