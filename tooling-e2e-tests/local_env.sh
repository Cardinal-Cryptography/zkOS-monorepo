# ======================================================================================================================
# Node configuration
# ======================================================================================================================
NODE_RPC_PORT=8545
export NODE_RPC_PORT
NODE_RPC_URL="http://localhost:${NODE_RPC_PORT}"
export NODE_RPC_URL
CHAIN_ID=31337
export CHAIN_ID

# ======================================================================================================================
# Contract configuration
# ======================================================================================================================
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 # Pre-funded anvil account
export DEPLOYER_PRIVATE_KEY

# ======================================================================================================================
# User configuration
# ======================================================================================================================
ALICE_PUBLIC_KEY=0xCaCa0634D1CEF7BD98c07e65C14Dd1B619906dD4 # Random address without any funds by default
export ALICE_PUBLIC_KEY
ALICE_PRIVATE_KEY=0xd5a92218e15fd2854d458af1a50c902e6ababaa34c3dfea239a5ef5eba651250 # Corresponding private key
export ALICE_PRIVATE_KEY

BOB_PUBLIC_KEY=0xCAcA0eBb138B57A84EAF49B38dA122e507CE9a2f # Random address without any funds by default
export BOB_PUBLIC_KEY
BOB_PRIVATE_KEY=0x708e5a9d43a2a5b8eb4ccdd44ee7faebb559b5454a58f719dbb0ff904d047648 # Corresponding private key
export BOB_PRIVATE_KEY

CHARLIE_PUBLIC_KEY=0xcACA0B734B779c97fc25BF9723e622649cFCDDfe # Random address without any funds by default
export CHARLIE_PUBLIC_KEY
CHARLIE_PRIVATE_KEY=0xa68e4f75a36d07db56c06b1103c9158801f0f1f24a07deae9324ee86b0753494 # Corresponding private key
export CHARLIE_PRIVATE_KEY

TS_SDK_PUBLIC_KEY=0xC881A90D50c4F267AdD6e94720299E31b214aA5C # Random address without any funds by default
export TS_SDK_PUBLIC_KEY
TS_SDK_PRIVATE_KEY=0xbdb9193adbb1dc104b51c09f9cb4456d395ac334324d72c477039bca4a6cad5e # Corresponding private key
export TS_SDK_PRIVATE_KEY

WITHDRAWAL_PUBLIC_KEY=0xCaCA0cf7Ad10377313e391E8eF365c0ED0C51057 # Random address without any funds by default
export WITHDRAWAL_PUBLIC_KEY

ALICE_STATE_FILE=~/.shielder-state-alice
BOB_STATE_FILE=~/.shielder-state-bob
CHARLIE_STATE_FILE=~/.shielder-state-charlie

# ======================================================================================================================
# Relayer configuration
# ======================================================================================================================
RELAYER_PORT=4141 # Relayer service port
export RELAYER_PORT

FEE_DESTINATION=0xcaca0a3147bcaf6d7B706Fc5F5c325E6b0e7fb34 # Random address without any funds by default.
FEE_DESTINATION_KEY=0x11bc58beea7f9baab53bbef30a478ebc1657b475869b0d966e8c17a02218e529 # Corresponding signing key.
export FEE_DESTINATION_KEY

RELAYER_SIGNING_KEYS=0x547a81fc1782a6f29613dd15fe0f97321379875fe5a99e2a9d8258b4d51ac660,b466c488864884d64daf2ff0a117d4a39c10e6b294cb9199ff70730dcd84dcc0,ba07224f2bf545f5409be9fb09fd55d95ef9f8a2567461146b94a9a9e09ec1e2
export RELAYER_SIGNING_KEYS
RELAYER_SIGNER_ADDRESSES=("0xCacA011152e011634cFC7f663998af44BC55FF4c" "0xCaCa0Bd0baFbea855b0Bb2776F689b0f46cFA592" "0xCAcA018473E24A5d1B993C26e88943C49b63ED98")
export RELAYER_SIGNER_ADDRESSES

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
