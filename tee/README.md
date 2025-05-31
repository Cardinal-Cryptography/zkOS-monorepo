## Building

To build the enclave images you will need `nix` installed (see https://nixos.org/download/#download-nix), and then:

```bash
cd nix
nix build
```

## Setup

Copy (or create your own) `.env.example` to `.env`.

## Migrations

To setup the DB with no fuss, just `make migrate`. To rerun from an empty state `make migrate-fresh`.
