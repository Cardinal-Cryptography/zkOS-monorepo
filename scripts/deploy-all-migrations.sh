#!/usr/bin/env bash

# Default network is anvil
NETWORK=${NETWORK:-anvil}

# Anvil default private key
ANVIL_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

if [ "$NETWORK" = "anvil" ]; then
    # Use default anvil private key if not provided
    PRIVATE_KEY=$ANVIL_PRIVATE_KEY
    OWNER_ADDRESS=$(cast wallet address "$PRIVATE_KEY")
    
    # Get the sender address from private key
    SENDER=$(cast wallet address "$PRIVATE_KEY")
    
    # Deploy scripts for anvil
    
    SHIELDER_PROXY=$(
        PRIVATE_KEY=$PRIVATE_KEY \
        OWNER_ADDRESS=$OWNER_ADDRESS \
        forge script DeployShielderScript --broadcast --rpc-url anvil --sender "$SENDER" \
        | grep 'Shielder deployed at:' | awk '{print $NF}'
    )
    SHIELDER_PROXY=$SHIELDER_PROXY PRIVATE_KEY=$PRIVATE_KEY OWNER_ADDRESS=$OWNER_ADDRESS \
    forge script AddTokenSupport --broadcast --rpc-url anvil --sender "$SENDER"
else
    # Get the sender address from private key
    SENDER=$(cast wallet address "$PRIVATE_KEY")
    
    # Deploy scripts for other networks
    SHIELDER_PROXY=$(
        PRIVATE_KEY=$PRIVATE_KEY \
        OWNER_ADDRESS=$OWNER_ADDRESS \
        forge script DeployShielderScript --broadcast --rpc-url "$NETWORK" --sender "$SENDER" \
        | grep 'Shielder deployed at:' | awk '{print $NF}'
    )
    SHIELDER_PROXY=$SHIELDER_PROXY PRIVATE_KEY=$PRIVATE_KEY OWNER_ADDRESS=$OWNER_ADDRESS \
    forge script DeployShielderV0_1_0Script --broadcast --rpc-url "$NETWORK" --sender "$SENDER"
fi
