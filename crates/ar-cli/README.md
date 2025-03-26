# AR-cli

Cli tool that can:
- generate symmetric encryption keys to be used in Shielder.
- populate a db by matching a decrypted viewing keys with the transactions.
- answer a queries about transaction (by their tx-hash).

## HowTo

First thing you want to do is to decode and collect viewing keys:

```bash
RUST_LOG=debug cargo run --bin ar-cli -- collect-keys --shielder-address $SHIELDER
```

Next index Shielder events:

```bash
RUST_LOG=debug cargo run --bin ar-cli -- index-events --shielder-address $SHIELDER
```

In a next step the keys are matched with the events:

```bash
RUST_LOG=debug cargo run --bin ar-cli -- revoke
```

At this point all the tables are populated with an up-to-date information and the tool can answer queries about particular transactions:

```bash
RUST_LOG=debug cargo run --bin ar-cli -- reveal --tx-hash 0x2e35668a233b612f85c81718516c87be6b8309c21146dac4a1e64a6c5cc9ce6c
```
