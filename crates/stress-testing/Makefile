.PHONY: help
help: ## Displays this help
	@awk 'BEGIN {FS = ":.*##"; printf "$(MAKEFILE_NAME)\nUsage:\n  make \033[1;36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[1;36m%-25s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: build
build: ## Build the package
	@cargo build --release

.PHONY: build-relayer-image
build-relayer-image: ## Build the relayer image
	@cd ../shielder-relayer && make build && make build-image

.PHONY: run-locally
run-locally: build build-relayer-image ## Run the stress testing in the local environment
	@./local-scenario.sh

.PHONY: run-testnet
run-testnet: build build-relayer-image ## Run the stress testing in the testnet environment
	@./testnet-scenario.sh
