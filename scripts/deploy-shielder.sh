#!/usr/bin/env bash

set -euo pipefail

# Display help information
function show_help {
    echo "Usage: ./deploy-shielder.sh [OPTIONS]"
    echo ""
    echo "Deploy the Shielder contract to the specified network."
    echo ""
    echo "Options:"
    echo "  --help                Show this help message and exit"
    echo ""
    echo "Environment Variables:"
    echo "  NETWORK              Target network (default: anvil)"
    echo "  PRIVATE_KEY          Private key for deployment"
    echo "  IS_ARBITRUM_CHAIN    Flag to indicate if the target network is Arbitrum (default: true)"
    echo "  AR_PUBLIC_KEY        Anonymity Revoker public key as a CSV pair 'x,y'"
    echo "  AR_SEED              Seed to generate Anonymity Revoker key pair"
    echo ""
    echo "If AR_PUBLIC_KEY is provided, it will be used directly."
    echo "If AR_SEED is provided but not AR_PUBLIC_KEY, a new key pair will be generated."
    echo "If neither is provided, default values (1,17631683881184975370165255887551781615748388533673675138860) will be used."
    exit 0
}

# Parse command line arguments
for arg in "$@"; do
    case $arg in
        --help)
            show_help
            ;;
    esac
done

NETWORK=${NETWORK:-anvil}
OWNER_ADDRESS=$(cast wallet address ${PRIVATE_KEY})
IS_ARBITRUM_CHAIN=${IS_ARBITRUM_CHAIN:-true}

# Handle AR public key
if [ -n "${AR_PUBLIC_KEY:-}" ]; then
    # Extract X and Y from the CSV format x,y
    AR_PUBLIC_KEY_X=$(echo $AR_PUBLIC_KEY | cut -d ',' -f 1)
    AR_PUBLIC_KEY_Y=$(echo $AR_PUBLIC_KEY | cut -d ',' -f 2)
    echo "Using provided AR public key: $AR_PUBLIC_KEY_X, $AR_PUBLIC_KEY_Y"
elif [ -n "${AR_SEED:-}" ]; then
    # Generate the public key using ar-cli
    echo "Generating AR key pair from seed..."
    cargo run --bin ar-cli -- generate --seed ${AR_SEED} --endianess big-endian
    
    AR_PUBLIC_KEY_X=$(cat public_key_x_coord.bin | cast from-bin)
    AR_PUBLIC_KEY_Y=$(cat public_key_y_coord.bin | cast from-bin)
    echo "Generated AR public key: $AR_PUBLIC_KEY_X, $AR_PUBLIC_KEY_Y"
else
    # Use default values
    AR_PUBLIC_KEY_X=$(cast to-uint256 1)
    AR_PUBLIC_KEY_Y=$(cast to-uint256 17631683881184975370165255887551781615748388533673675138860)
    echo "Using default AR public key: 1, 17631683881184975370165255887551781615748388533673675138860"
fi

# Deploy the contract
echo "Deploying Shielder contract to $NETWORK..."
PRIVATE_KEY=${PRIVATE_KEY} \
OWNER_ADDRESS=${OWNER_ADDRESS} \
AR_PUBLIC_KEY_X=${AR_PUBLIC_KEY_X} \
AR_PUBLIC_KEY_Y=${AR_PUBLIC_KEY_Y} \
IS_ARBITRUM_CHAIN=${IS_ARBITRUM_CHAIN} \
forge script DeployShielderScript --broadcast --rpc-url ${NETWORK} --sender $(cast wallet address ${PRIVATE_KEY})
