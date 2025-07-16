{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    nitro-util.url = "github:monzo/aws-nitro-util";
    nitro-util.inputs.nixpkgs.follows = "nixpkgs";

    flake-utils.url = "github:numtide/flake-utils";
    crane.url = "github:ipetkov/crane";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # below depency is also used in tee/Cargo.toml, which is far from ideal since one needs to bump it there as well
    zkOS-monorepo = {
      url = "git+https://github.com/Cardinal-Cryptography/zkOS-monorepo?rev=374a0d5dea2128e9b5100ede6daecc9253a241d9";
      flake = false;
    };
  };
  outputs = { nitro-util, nixpkgs, flake-utils, crane, rust-overlay, zkOS-monorepo, ... }: (flake-utils.lib.eachDefaultSystem (system:
    let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ (import rust-overlay) ];
      };

      craneLib = (crane.mkLib pkgs).overrideToolchain (
        p:
        p.rust-bin.stable.latest.default.override {
          targets = [ "x86_64-unknown-linux-musl" ];
        }
      );

      nitro = nitro-util.lib.${system};
    in
    rec {
      defaultPackage = packages.all;

      packages = {
        all = pkgs.linkFarm "all" [
          { name = "shielderProverTEE"; path = packages.shielderProverTEE; }
        ];

        shielderProverTEE-binary = craneLib.buildPackage {
          pname = "shielder-prover-tee";
          cargoExtraArgs = "-p shielder-prover-tee";
          version = "0.1.0";

          src = "${zkOS-monorepo}/tee";
          strictDeps = true;

          CARGO_BUILD_TARGET = "x86_64-unknown-linux-musl";
          CARGO_BUILD_RUSTFLAGS = "-C target-feature=+crt-static";
          PTAU_RESOURCES_DIR = "${zkOS-monorepo}/resources";

          postInstall = "mv $out/bin/shielder-prover-tee $out/bin/entrypoint";
        };

        shielderProverTEE =
          let
            crossArch = "x86_64";
            crossPkgs = import nixpkgs { inherit system; crossSystem = "${crossArch}-linux"; };
          in
          crossPkgs.callPackage ./enclave.nix {
            inherit crossArch nitro;
            entrypoint = packages.shielderProverTEE-binary;
          };
      };
    }));
}
