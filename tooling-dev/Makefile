GIT_SHA1_SHORT := $(shell cat .git-sha | tr -d '[:space:]')

NETWORK ?= anvil
PRIVATE_KEY ?= 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 # pkey of the dev account `0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E` prefunded with ETH on all networks
RELAYER_DOCKER_IMAGE ?= 573243519133.dkr.ecr.us-east-1.amazonaws.com/shielder-relayer:${GIT_SHA1_SHORT}

.PHONY: help
help: # Show help for each of the Makefile recipes.
	@grep -E '^[a-zA-Z0-9 -]+:.*#'  Makefile | sort | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done

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

.PHONY: deploy-contracts
deploy-contracts: # Deploy solidity contracts
deploy-contracts: deps
ifeq ($(NETWORK),anvil)
	PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 forge script DeployShielderScript --broadcast --rpc-url anvil
else
	PRIVATE_KEY=$(PRIVATE_KEY) forge script DeployShielderScript --broadcast --rpc-url $(NETWORK)
endif

.PHONY: download-relayer
download-relayer: # Download relayer docker image
download-relayer:
	docker pull ${RELAYER_DOCKER_IMAGE}

.PHONY: run-relayer
run-relayer: # Run relayer
run-relayer: download-relayer
	source ./local_env.sh && \
	SHIELDER_CONTRACT_ADDRESS="0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" \
	NODE_RPC_URL="http://host.docker.internal:8545" \
	DOCKER_USER="$(id -u):$(id -g)" \
	RELAYER_CONTAINER_NAME=shielder-relayer \
	RELAYER_DOCKER_IMAGE=${RELAYER_DOCKER_IMAGE} \
	./run-relayer.sh
