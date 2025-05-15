SHELL := /bin/bash

CARGO_FILES = ../../Cargo.toml ../../Cargo.lock Cargo.toml

BUILD ?= client
DOCKER_USER = "$(id -u):$(id -g)"
DETACHED ?= true

RELAYER_CONTAINER_NAME = shielder-relayer
RELAYER_DOCKER_IMAGE = shielder-relayer

.PHONY: help
help: ## Displays this help
	@awk 'BEGIN {FS = ":.*##"; printf "$(MAKEFILE_NAME)\nUsage:\n  make \033[1;36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[1;36m%-25s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: build
build:
	@cargo build --release

.PHONY: test
test: build-image ## Run tests
	@./test.sh

.PHONY: lint
lint: ## Run linter
	@cargo clippy --release -- -D warnings
	@cargo +nightly fmt --all

.PHONY: build-image
build-image:  ## Builds a Docker image with the Relayer service binary. Use BUILD=client to use a binary built on the client.
ifeq ($(BUILD),client)
	@cargo build --release
	@cd ../.. && docker build --tag "${RELAYER_DOCKER_IMAGE}" -f "crates/shielder-relayer/docker/Dockerfile.client" .
else ifeq ($(BUILD),docker)
	@cd ../.. && DOCKER_BUILDKIT=1 docker build --tag "${RELAYER_DOCKER_IMAGE}" -f "crates/shielder-relayer/docker/Dockerfile.docker" .
else
	echo "Don't know what to do with ${BUILD}"; exit -1;
endif

.PHONY: run
run: ## Run the Relayer service in a local detached Docker container
run: build-image stop ## Start the Relayer service in a local Docker container
	@DOCKER_USER=$(DOCKER_USER) \
	RELAYER_CONTAINER_NAME=$(RELAYER_CONTAINER_NAME) \
	RELAYER_DOCKER_IMAGE=$(RELAYER_DOCKER_IMAGE) \
	DETACHED=$(DETACHED) \
	./run-relayer.sh

.PHONY: stop
stop:
	@docker kill "${RELAYER_CONTAINER_NAME}" 1> /dev/null 2>&1 || true
	@docker rm "${RELAYER_CONTAINER_NAME}" 1> /dev/null 2>&1 || true

.PHONY: start-dummy
start-dummy: ## Just start the relayer in a local Docker container with mocked contract addresses. Useful for debugging.
start-dummy: build-image stop
	@DOCKER_USER=$(DOCKER_USER) \
	RELAYER_CONTAINER_NAME=$(RELAYER_CONTAINER_NAME) \
	RELAYER_DOCKER_IMAGE=$(RELAYER_DOCKER_IMAGE) \
	NODE_RPC_URL="http://localhost:8545" \
	FEE_DESTINATION_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
    RELAYER_SIGNING_KEYS="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" \
    SHIELDER_CONTRACT_ADDRESS="0x1111111111111111111111111111111111111111" \
    TOKEN_CONFIG="[{\"kind\":\"Native\", \"price_provider\":{\"Static\": 1}}]" \
	./run-relayer.sh
