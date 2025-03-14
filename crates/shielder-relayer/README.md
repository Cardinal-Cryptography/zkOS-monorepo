# shielder-relayer

This crate provides a relayer service for the Shielder system.
It implements concept described in https://docs.alephzero.org/aleph-zero/protocol-details/shielder/relayers.

# Usage

## Running the relayer natively

You can run the relayer just like any other Rust binary with `cargo run --release`, providing the necessary
configuration
via CLI arguments, environment variables or relying on the defaults.

For a full list of available options, run `cargo run --release -- --help`.

## Running the relayer in Docker

You can also run the relayer in a Docker container.

```shell
# This is for building the Docker image and starting a container with mocked contract and accounts. Won't be functional
# for real use cases, but can be useful for testing or debugging.
make start-dummy

# This is for building the Docker image and starting a container with the real relayer service. Requires setting proper
# environment variables.
make run
```

# Service configuration

The relayer service can be configured via CLI arguments or environment variables. Some options can do fallback to
defaults not provided.

| Option                            | Description                                                                                                                                                                             | Env variable                    | Default value               |
|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|-----------------------------|
| `--logging-format`                | Logging format configuration.                                                                                                                                                           | `LOGGING_FORMAT`                | `Text`                      |
|                                   |                                                                                                                                                                                         |                                 |                             |
| `--host`                          | Host where the server should be run.                                                                                                                                                    | `RELAYER_HOST`                  | `0.0.0.0`                   |
| `--port`                          | Port where the server should be run.                                                                                                                                                    | `RELAYER_PORT`                  | `4141`                      |
| `--metrics-port`                  | Port where the server metrics should be exposed.                                                                                                                                        | `RELAYER_METRICS_PORT`          | `9615`                      |
|                                   |                                                                                                                                                                                         |                                 |                             |
| `--node-rpc-url`                  | URL of the Ethereum RPC node.                                                                                                                                                           | `NODE_RPC_URL`                  |                             |
| `--shielder-contract-address`     | Address of the Shielder contract.                                                                                                                                                       | `SHIELDER_CONTRACT_ADDRESS`     |                             |
| `--total-fee`                     | The total fee, which is used as an argument for `withdraw_native` call. It should be a fixed value, close to a sum of 'withdraw_native' on-chain gas cost and the intended relayer fee. | `TOTAL_FEE`                     | `"100_000_000_000_000_000"` |
| `--relay-gas`                     | The estimated amount of gas 'withdraw_native' on-chain call burns.                                                                                                                      | `RELAY_GAS`                     | `2000000`.                  |
| `--native-token`                  | Token native to chain where the relayer operates.                                                                                                                                       | `NATIVE_TOKEN`                  |                             |
|                                   |                                                                                                                                                                                         |                                 |                             |
| `--balance-monitor-interval-secs` | Interval (in seconds) for monitoring signers' balances.                                                                                                                                 | `BALANCE_MONITOR_INTERVAL_SECS` | `900`                       |
| `--nonce-policy`                  | Nonce management policy.                                                                                                                                                                | `NONCE_POLICY`                  | `Caching`                   |
| `--dry-running`                   | Dry running policy.                                                                                                                                                                     | `DRY_RUNNING`                   | `Always`                    |
| `--relay-count-for-recharge`      | Relay count for recharge.                                                                                                                                                               | `RELAY_COUNT_FOR_RECHARGE`      | `20`                        |
| `--token-config`                  | Token pricing configuration for tokens that are qualified as a fee token.                                                                                                               | `TOKEN_CONFIG`                  | empty                       |
| `--price-feed-refresh-interval`   | Price feed refresh interval in seconds.                                                                                                                                                 | `PRICE_FEED_REFRESH_INTERVAL`   | `60`                        |
| `--price-feed-validity`           | Price feed validity in seconds.                                                                                                                                                         | `PRICE_FEED_VALIDITY`           | `600`                       |
|                                   |                                                                                                                                                                                         |                                 |                             |
| `--fee-destination-key`           | Signing key of the address where the fees should go.                                                                                                                                    | `FEE_DESTINATION_KEY`           |                             |
| `--signing-keys`                  | Signing keys of the relayer.                                                                                                                                                            | `RELAYER_SIGNING_KEYS`          |                             |

# API

TO BE DONE, ONCE ADR IS IMPLEMENTED