# shielder-relayer

This crate provides a relayer service for the Shielder system.
It implements concept described in https://docs.alephzero.org/aleph-zero/protocol-details/shielder/relayers.

# Usage

## Running the relayer natively

You can run the relayer just like any other Rust binary with `cargo run --release`.

```shell
Configuration for the Shielder relayer through the command line arguments.

All fields are optional, as they can be provided either through environment variables or, in some cases, through default values.

Usage: shielder-relayer [OPTIONS]

Options:
      --logging-format <LOGGING_FORMAT>
          Logging format configuration. If not provided, the value from the environment variable `LOGGING_FORMAT` will be used. If that is not set, the default value is `Text`.

          [possible values: text, json]

      --host <HOST>
          Host where the server should be run. If not provided, the value from the environment variable `RELAYER_HOST` will be used. If that is not set, the default value is `0.0.0.0`.

      --port <PORT>
          Port where the server should be run. If not provided, the value from the environment variable `RELAYER_PORT` will be used. If that is not set, the default value is `4141`.

      --metrics-port <METRICS_PORT>
          Port where the server metrics should be exposed. If not provided, the value from the environment variable `RELAYER_METRICS_PORT` will be used. If that is not set, the default value is `9615`.

      --balance-monitor-interval-secs <BALANCE_MONITOR_INTERVAL_SECS>
          Interval (in seconds) for monitoring signers' balances. If not provided, the value from the environment variable `BALANCE_MONITOR_INTERVAL_SECS` will be used. If that is not set, the default value is `900`.

      --node-rpc-url <NODE_RPC_URL>
          URL of the Ethereum RPC node. If not provided, the value from the environment variable `NODE_RPC_URL` will be used.

      --shielder-contract-address <SHIELDER_CONTRACT_ADDRESS>
          Address of the Shielder contract. If not provided, the value from the environment variable `SHIELDER_CONTRACT_ADDRESS` will be used.

      --fee-destination-key <FEE_DESTINATION_KEY>
          Signing key of the address where the fees should go. If not provided, the value from the environment variable `FEE_DESTINATION_KEY` will be used.

      --signing-keys <SIGNING_KEYS>...
          Signing keys of the relayer. If not provided, the value from the environment variable `RELAYER_SIGNING_KEYS` will be used.

      --nonce-policy <NONCE_POLICY>
          Nonce management policy. If not provided, the value from the environment variable `NONCE_POLICY` will be used. If that is not set, the default value is `Caching`.

          [possible values: caching, stateless]

      --dry-running <DRY_RUNNING>
          Dry running policy. If not provided, the value from the environment variable `DRY_RUNNING` will be used. If that is not set, the default value is `Always`.

          [possible values: always, optimistic]

      --relay-count-for-recharge <RELAY_COUNT_FOR_RECHARGE>
          Relay count for recharge. If not provided, the value from the environment variable `RELAY_COUNT_FOR_RECHARGE` will be used. If that is not set,the default value is `20`.

      --total-fee <TOTAL_FEE>
          The total relayer fee, which is used as an argument for `withdraw_native` call. It should be a fixed value, close to a sum of 'withdraw_native' on-chain gas cost and the intended relayer fee. If not provided, the value from the environment variable `TOTAL_FEE` will be used. If that is not set, the default value is `"100_000_000_000_000_000"`.

      --relay-gas <RELAY_GAS>
          The estimated amount of gas 'withdraw_native' on-chain call burns. If not provided, the value from the environment variable `RELAY_GAS` will be used. If that is not set,the default value is `2000000`.

  -h, --help
          Print help (see a summary with '-h')
```

## Running the relayer in Docker

You can also run the relayer in a Docker container.

```shell
RELAYER_PORT=4141 \
NODE_RPC_URL=http://localhost:8545 \
RELAYER_ADDRESS=0xCacA011152e011634cFC7f663998af44BC55FF4c \
RELAYER_SIGNING_KEY=0x547a81fc1782a6f29613dd15fe0f97321379875fe5a99e2a9d8258b4d51ac660 \
SHIELDER_CONTRACT_ADDRESS=0xCaCa0634D1CEF7BD98c07e65C14Dd1B619906dD4 \
make run && \
docker logs shielder-relayer --follow
```

This will run a Docker container `shielder-relayer` with the service available on `RELAYER_PORT` (default: 4141).
You can stop the service with `make stop`.

# API

Apart from operational / monitoring endpoints, the relayer provides the following API:

## `POST /relay`

Submits a new withdrawal transaction to the Shielder contract through the relayer.
It expects one json object in the body, compliant with the structure:

```rust
pub struct RelayQuery {
    pub expected_contract_version: FixedBytes<3>,
    pub amount: U256,
    pub withdraw_address: Address,
    pub merkle_root: U256,
    pub nullifier_hash: U256,
    pub new_note: U256,
    pub proof: Bytes,
}
```
