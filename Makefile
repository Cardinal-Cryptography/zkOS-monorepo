NETWORK ?= anvil
PRIVATE_KEY ?= 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 # pkey of the dev account `0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E` prefunded with ETH on all networks
OWNER_ADDRESS ?= $(shell cast wallet address $(PRIVATE_KEY))

.PHONY: help
help: # Show help for each of the Makefile recipes.
	@grep -E '^[a-zA-Z0-9 -]+:.*#'  Makefile | sort | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done

.PHONY: clean
clean: # Remove all generated data
clean:
	git clean -fdX

.PHONY: deps
deps: # Install dependencies
deps:
	npm install

.PHONY: anvil
anvil: # Run local anvil node
anvil:
	./scripts/aleph-anvil.sh -p 8545

.PHONY: stop-anvil
stop-anvil: # Stop local anvil node
stop-anvil:
	pkill anvil

.PHONY: watch-contracts
watch-contracts: # watcher on the eth contracts. Scripts dir is watched by default
watch-contracts:
	forge clean && forge build --watch contracts/**/*.sol --watch scripts/*.sol --watch test/*.sol

.PHONY: format-contracts
format-contracts: # Format solidity contracts
format-contracts:
	npx prettier --write --plugin=prettier-plugin-solidity 'contracts/**/*.sol' 'scripts/*.sol' 'test/*.sol'

.PHONY: lint-contracts
lint-contracts: # Lint solidity contracts
lint-contracts:
	npx solhint -c .solhint.json 'contracts/*.sol' 'scripts/*.sol' 'test/*.sol'

.PHONY: compile-contracts
compile-contracts: # Compile solidity contracts
compile-contracts: deps generate-contracts
	forge clean && forge build

.PHONY: deploy-contracts
deploy-contracts: # Deploy solidity contracts
deploy-contracts:
ifeq ($(NETWORK),anvil)
	$(eval PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) \
	PRIVATE_KEY=$(PRIVATE_KEY) OWNER_ADDRESS=$(OWNER_ADDRESS) forge script DeployShielderScript --broadcast --rpc-url anvil --sender $(shell cast wallet address $(PRIVATE_KEY))
else
	PRIVATE_KEY=$(PRIVATE_KEY) OWNER_ADDRESS=$(OWNER_ADDRESS) forge script DeployShielderScript --broadcast --rpc-url $(NETWORK) --sender $(shell cast wallet address $(PRIVATE_KEY))
endif

.PHONY: deploy-contracts-v0_1_0
deploy-contracts-v0_1_0: # Deploy solidity contracts
deploy-contracts-v0_1_0:
ifeq ($(NETWORK),anvil)
	$(eval PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) \
	PRIVATE_KEY=$(PRIVATE_KEY) OWNER_ADDRESS=$(OWNER_ADDRESS) forge script DeployShielderV0_1_0Script --broadcast --rpc-url anvil --sender $(shell cast wallet address $(PRIVATE_KEY))
else
	PRIVATE_KEY=$(PRIVATE_KEY) OWNER_ADDRESS=$(OWNER_ADDRESS) forge script DeployShielderV0_1_0Script --broadcast --rpc-url $(NETWORK) --sender $(shell cast wallet address $(PRIVATE_KEY))
endif

.PHONY: generate-poseidon-contracts
generate-poseidon-contracts: # Generate Poseidon contract
generate-poseidon-contracts:
	python3 poseidon2-solidity/generate_t8.py > contracts/Poseidon2T8Assembly.sol
	npx prettier --write --plugin=prettier-plugin-solidity 'contracts/Poseidon2T*Assembly.sol'

.PHONY: generate-verifier-contracts
generate-verifier-contracts: # Generate relation verifier contracts
generate-verifier-contracts:
	cd crates/halo2-verifier
	cargo run --release --bin halo2_solidity_verifier_generator
	$(MAKE) format-contracts


.PHONY: generate-verifier-contracts-v0_1_0
generate-verifier-contracts-v0_1_0: # Generate relation verifier contracts for v0_1_0 contract
generate-verifier-contracts-v0_1_0:
	cd crates/halo2-verifier
	cargo run --release --bin halo2_solidity_verifier_generator_v0_1_0
	$(MAKE) format-contracts

.PHONY: generate-contracts
generate-contracts: # Generate poseidon & relation verifier contracts
generate-contracts: generate-poseidon-contracts generate-verifier-contracts

.PHONY: generate-contracts-v0_1_0
generate-contracts-v0_1_0: # Generate poseidon & relation verifier contracts
generate-contracts-v0_1_0: generate-poseidon-contracts generate-verifier-contracts-v0_1_0

.PHONY: measure-gas
measure-gas: # measure shielder gas usage
measure-gas: compile-contracts
	CONTRACTS_DIR=contracts CARGO_MANIFEST_DIR=./Cargo.toml cargo run -p integration-tests --bin gas-consumption --release -- current-report.txt

.PHONY: format-rust
format-rust: # Format all rust crates
format-rust:
	cargo +nightly fmt --all -- --check

.PHONY: lint-rust
lint-rust: # Lint all rust crates
lint-rust:
	cargo clippy --release -- -D warnings
