#!/bin/bash

# Fee Estimator Start Script
# This script sets up environment variables and runs the fee estimator service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --env-file FILE          Load environment variables from file (default: .env)"
    echo "  --rpc-url URL           RPC endpoint URL"
    echo "  --contract-address ADDR  Shielder contract address"
    echo "  --empty-account-pk KEY   Empty account private key"
    echo "  --created-account-pk KEY Created account private key"
    echo "  --erc20-token-addr ADDR  ERC20 token address"
    echo "  --fee-refresh-interval MS Fee refresh interval in milliseconds (default: 60000)"
    echo "  --help                   Show this help message"
    echo ""
    echo "Environment variables (can be set in .env file or exported):"
    echo "  RPC_URL                  RPC endpoint URL"
    echo "  CONTRACT_ADDRESS         Shielder contract address"
    echo "  EMPTY_ACCOUNT_PK   Empty account private key"
    echo "  CREATED_ACCOUNT_PK Created account private key"
    echo "  ERC20_TOKEN_ADDRESS      ERC20 token address"
    echo "  FEE_REFRESH_INTERVAL_MILLIS Fee refresh interval in milliseconds"
    echo ""
    echo "Example:"
    echo "  $0 --env-file fee-estimator.env"
    echo "  $0 --rpc-url https://rpc.alephzero-testnet.gelato.digital --contract-address 0x1111..."
}

# Default values
ENV_FILE=".env"
FEE_REFRESH_INTERVAL_DEFAULT="60000"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --rpc-url)
            export RPC_URL="$2"
            shift 2
            ;;
        --contract-address)
            export CONTRACT_ADDRESS="$2"
            shift 2
            ;;
        --empty-account-pk)
            export EMPTY_ACCOUNT_PK="$2"
            shift 2
            ;;
        --created-account-pk)
            export CREATED_ACCOUNT_PK="$2"
            shift 2
            ;;
        --erc20-token-addr)
            export ERC20_TOKEN_ADDRESS="$2"
            shift 2
            ;;
        --fee-refresh-interval)
            export FEE_REFRESH_INTERVAL_MILLIS="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Load environment file if it exists
if [[ -f "$ENV_FILE" ]]; then
    print_info "Loading environment variables from $ENV_FILE"
    set -a  # automatically export all variables
    source "$ENV_FILE"
    set +a
else
    if [[ "$ENV_FILE" != ".env" ]]; then
        print_error "Environment file $ENV_FILE not found"
        exit 1
    else
        print_warning "No .env file found, using environment variables or command line arguments"
    fi
fi

# Set default values for optional variables
export FEE_REFRESH_INTERVAL_MILLIS="${FEE_REFRESH_INTERVAL_MILLIS:-$FEE_REFRESH_INTERVAL_DEFAULT}"

# Validate required environment variables
REQUIRED_VARS=(
    "RPC_URL"
    "CONTRACT_ADDRESS"
    "EMPTY_ACCOUNT_PK"
    "CREATED_ACCOUNT_PK"
    "ERC20_TOKEN_ADDRESS"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        MISSING_VARS+=("$var")
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please set these variables in your environment, .env file, or use command line arguments."
    show_usage
    exit 1
fi

# Validate addresses (basic hex format check)
validate_address() {
    local addr="$1"
    local name="$2"
    if [[ ! "$addr" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "Invalid $name address format: $addr"
        print_error "Address should be a 40-character hex string starting with 0x"
        exit 1
    fi
}

validate_address "$CONTRACT_ADDRESS" "contract"
validate_address "$ERC20_TOKEN_ADDRESS" "ERC20 token"

# Validate fee refresh interval is a number
if ! [[ "$FEE_REFRESH_INTERVAL_MILLIS" =~ ^[0-9]+$ ]]; then
    print_error "FEE_REFRESH_INTERVAL_MILLIS must be a positive integer"
    exit 1
fi

# Print configuration summary
print_info "Starting Fee Estimator with configuration:"
echo "  RPC URL: $RPC_URL"
echo "  Contract Address: $CONTRACT_ADDRESS"
echo "  ERC20 Token Address: $ERC20_TOKEN_ADDRESS"
echo "  Fee Refresh Interval: ${FEE_REFRESH_INTERVAL_MILLIS}ms"
echo "  Empty Account Key: [HIDDEN]"
echo "  Created Account Key: [HIDDEN]"
echo ""

# Change to the fee-estimator directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_info "Running cargo run in $(pwd)"

# Run the fee estimator
exec cargo run
