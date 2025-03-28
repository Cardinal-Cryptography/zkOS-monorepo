# Expected variables set from the outside:
# - DEPLOYER_PRIVATE_KEY
# - ALICE_PUBLIC_KEY
# - ALICE_PRIVATE_KEY
# - BOB_PUBLIC_KEY
# - BOB_PRIVATE_KEY
# - CHARLIE_PUBLIC_KEY
# - CHARLIE_PRIVATE_KEY
# - TS_SDK_PUBLIC_KEY
# - TS_SDK_PRIVATE_KEY
# - FEE_DESTINATION
# - FEE_DESTINATION_KEY
# - RELAYER_SIGNER_ADDRESSES - as array
# - RELAYER_SIGNING_KEYS - comma-separated

NODE_RPC_URL="https://rpc.alephzero-testnet.gelato.digital"
export NODE_RPC_URL

CHAIN_ID=2039
export CHAIN_ID

WITHDRAWAL_PUBLIC_KEY=0xCaCA0cf7Ad10377313e391E8eF365c0ED0C51057 # Random address
export WITHDRAWAL_PUBLIC_KEY

ALICE_STATE_FILE=~/.shielder-state-alice
BOB_STATE_FILE=~/.shielder-state-bob
CHARLIE_STATE_FILE=~/.shielder-state-charlie

# ======================================================================================================================
# Relayer configuration
# ======================================================================================================================
RELAYER_PORT=4141 # Relayer service port
export RELAYER_PORT

RELAYER_URL="http://localhost:${RELAYER_PORT}"
export RELAYER_URL

NONCE_POLICY=caching
export NONCE_POLICY
DRY_RUNNING=optimistic
export DRY_RUNNING

RELAY_COUNT_FOR_RECHARGE=1
export RELAY_COUNT_FOR_RECHARGE
BALANCE_MONITOR_INTERVAL_SECS=5
export BALANCE_MONITOR_INTERVAL_SECS

NATIVE_TOKEN="eth"
export NATIVE_TOKEN

TOTAL_FEE="100000000000000000"
export TOTAL_FEE
