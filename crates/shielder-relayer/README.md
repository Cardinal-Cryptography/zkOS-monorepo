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

| Option                            | Description                                                                                                                                                                             | Env variable                  | Default value             |
|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------|---------------------------|
| `--node-rpc-url`                  | URL of the Ethereum RPC node.                                                                                                                                                           | `NODE_RPC_URL`                |                           |
| `--shielder-contract-address`     | Address of the Shielder contract.                                                                                                                                                       | `SHIELDER_CONTRACT_ADDRESS`   |                           |
| `--fee-destination-key`           | Signing key of the address where the fees should go.                                                                                                                                    | `FEE_DESTINATION_KEY`         |                           |
| `--signing-keys`                  | Signing keys of the relayer.                                                                                                                                                            | `RELAYER_SIGNING_KEYS`        |                           |
| `--token-config`                  | Token pricing configuration for tokens that are qualified as a fee token.                                                                                                               | `TOKEN_CONFIG`                |                           |
|                                   |                                                                                                                                                                                         |                               |                           |
| `--logging-format`                | Logging format configuration.                                                                                                                                                           | `LOGGING_FORMAT`              | `Text`                    |
|                                   |                                                                                                                                                                                         |                               |                           |
| `--host`                          | Host where the server should be run.                                                                                                                                                    | `RELAYER_HOST`                | `0.0.0.0`                 |
| `--port`                          | Port where the server should be run.                                                                                                                                                    | `RELAYER_PORT`                | `4141`                    |
| `--metrics-port`                  | Port where the server metrics should be exposed.                                                                                                                                        | `RELAYER_METRICS_PORT`        | `9615`                    |
|                                   |                                                                                                                                                                                         |                               |                           |
| `--total-fee`                     | The total fee, which is used as an argument for `withdraw_native` call. It should be a fixed value, close to a sum of 'withdraw_native' on-chain gas cost and the intended relayer fee. | `TOTAL_FEE`                   | `100_000_000_000_000_000` |
| `--relay-gas`                     | The estimated amount of gas 'withdraw_native' on-chain call burns.                                                                                                                      | `RELAY_GAS`                   | `2000000`.                |
|                                   |                                                                                                                                                                                         |                               |                           |
| `--balance-monitor-interval-secs` | Interval (in seconds) for monitoring signers' balances.                                                                                                                                 | `BALANCE_MONITOR_INTERVAL`    | 900 seconds               |
| `--nonce-policy`                  | Nonce management policy.                                                                                                                                                                | `NONCE_POLICY`                | `Caching`                 |
| `--dry-running`                   | Dry running policy.                                                                                                                                                                     | `DRY_RUNNING`                 | `Always`                  |
| `--relay-count-for-recharge`      | Relay count for recharge.                                                                                                                                                               | `RELAY_COUNT_FOR_RECHARGE`    | `20`                      |
|                                   |                                                                                                                                                                                         |                               |                           |
| `--price-feed-refresh-interval`   | Price feed refresh interval in seconds.                                                                                                                                                 | `PRICE_FEED_REFRESH_INTERVAL` | 60 seconds                |
| `--price-feed-validity`           | Price feed validity in seconds.                                                                                                                                                         | `PRICE_FEED_VALIDITY`         | 600 seconds               |
| `--service-fee-percent`           | Commission fee percentage (added to the actual relay cost).                                                                                                                             | `SERVICE_FEE_PERCENT`         | 15%                       |
| `--quote-validity`                | How long the quote provided by the service is valid. In seconds.                                                                                                                        | `QUOTE_VALIDITY`              | 15 seconds                |
| `--max-pocket-money`              | Maximum pocket money relayer can provide.                                                                                                                                               | `MAX_POCKET_MONEY`            | `100_000_000_000_000_000` |

# API

To inspect the API, you can use the OpenAPI specification provided by the service. By default, it is available at `/api` path.
