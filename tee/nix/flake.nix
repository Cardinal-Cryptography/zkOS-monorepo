{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    nitro-util.url = "github:monzo/aws-nitro-util";
    nitro-util.inputs.nixpkgs.follows = "nixpkgs";

    flake-utils.url = "github:numtide/flake-utils";
    fenix.url = "github:nix-community/fenix";
    naersk.url = "github:nix-community/naersk";
  };
  outputs = { nitro-util, nixpkgs, flake-utils, naersk, fenix, ... }: (flake-utils.lib.eachDefaultSystem (system:
    let
      pkgs = nixpkgs.legacyPackages.${system};
      nitro = nitro-util.lib.${system};

      toolchain = with fenix.packages.${system};
        combine [
          minimal.rustc
          minimal.cargo
          targets.x86_64-unknown-linux-musl.latest.rust-std
        ];

      naersk' = naersk.lib.${system}.override {
        cargo = toolchain;
        rustc = toolchain;
      };

      zkOS-monorepo-source = builtins.fetchGit {
        url = "https://github.com/Cardinal-Cryptography/zkOS-monorepo.git";
        rev = "da70131ba57ceb678a890c1b6e553710773686a8";
      };
    in
    rec {
      defaultPackage = packages.all;

      packages = {
        all = pkgs.linkFarm "all" [
          { name = "rewardTEE"; path = packages.rewardTEE; }
          { name = "shielderProverTEE"; path = packages.shielderProverTEE; }
        ];

        rewardTEE-binary = naersk'.buildPackage {
          src = "${zkOS-monorepo-source}/tee";

          doCheck = true;
          nativeBuildInputs = with pkgs; [ pkgsStatic.stdenv.cc ];
          cargoBuildOptions = (x: x ++ ["-p shielder-rewards-tee"] );
          CARGO_BUILD_TARGET = "x86_64-unknown-linux-musl";
          CARGO_BUILD_RUSTFLAGS = "-C target-feature=+crt-static";

          postInstall = "mv $out/bin/shielder-rewards-tee $out/bin/entrypoint";
        };

        shielderProverTEE-binary = naersk'.buildPackage {
          src = "${zkOS-monorepo-source}/tee";

          doCheck = true;
          nativeBuildInputs = with pkgs; [ pkgsStatic.stdenv.cc ];
          cargoBuildOptions = (x: x ++ ["-p shielder-prover-tee"] );
          CARGO_BUILD_TARGET = "x86_64-unknown-linux-musl";
          CARGO_BUILD_RUSTFLAGS = "-C target-feature=+crt-static";

          postInstall = "mv $out/bin/shielder-rewards-tee $out/bin/entrypoint";
        };

        rewardTEE =
          let
            crossArch = "x86_64";
            crossPkgs = import nixpkgs { inherit system; crossSystem = "${crossArch}-linux"; };
          in
          crossPkgs.callPackage ./enclave.nix {
            inherit crossArch nitro;
            entrypoint = packages.rewardTEE-binary;
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
