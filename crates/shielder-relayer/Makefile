SHELL := /bin/bash

CARGO_FILES = ../../Cargo.toml ../../Cargo.lock Cargo.toml

BUILD ?= client
DOCKER_USER = "$(id -u):$(id -g)"

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
	@cd ../.. && DOCKER_BUILDKIT=1 docker build --ssh default --tag "${RELAYER_DOCKER_IMAGE}" -f "crates/shielder-relayer/docker/Dockerfile.docker" .
else
	echo "Don't know what to do with ${BUILD}"; exit -1;
endif

.PHONY: ensure-image
ensure-image: ## Ensures Docker image exists, building only if necessary
	@if [ -z "$$(docker images -q ${RELAYER_DOCKER_IMAGE})" ]; then \
		echo "Docker image not found. Building..."; \
		$(MAKE) build-image; \
	else \
		echo "Docker image already exists. Skipping build."; \
	fi

.PHONY: run
run: ensure-image stop ## Start the Relayer service in a local Docker container
	@DOCKER_USER=$(DOCKER_USER) \
	RELAYER_CONTAINER_NAME=$(RELAYER_CONTAINER_NAME) \
	RELAYER_DOCKER_IMAGE=$(RELAYER_DOCKER_IMAGE) \
	./run-relayer.sh

.PHONY: stop
stop:
	@docker kill "${RELAYER_CONTAINER_NAME}" 1> /dev/null 2>&1 || true
	@docker rm "${RELAYER_CONTAINER_NAME}" 1> /dev/null 2>&1 || true
