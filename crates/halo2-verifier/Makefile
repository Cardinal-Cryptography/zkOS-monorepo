.PHONY: build
build: ## Build the project
	@cargo build --release

.PHONY: test
test: ## Run tests
	@cargo test -- --nocapture

.PHONY: lint
lint: ## Run clippy and fmt
	@cargo clippy --release -- -D warnings
	@cargo +nightly fmt --all

help: ## Displays this help
	@awk 'BEGIN {FS = ":.*##"; printf "$(MAKEFILE_NAME)\nUsage:\n  make \033[1;36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[1;36m%-25s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
