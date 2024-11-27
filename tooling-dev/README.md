# Shielder development environment

## Prerequisites

1. Make sure to have `foundry` installed [link](https://book.getfoundry.sh/getting-started/installation)
2. Make sure to have `npm` installed
3. Make sure to have `docker` installed
4. Have `AWS CLI` set up to aleph-zero mainnet AWS account, refer to https://www.notion.so/cardinalcryptography/Navigation-and-working-environment-05933ec1797f41139f7b28f8a0378210. Add docker registry as `aws ecr get-login-password --region us-east-1 --profile mainnet | docker login --username AWS --password-stdin 573243519133.dkr.ecr.us-east-1.amazonaws.com`. If you have troubles, contact our DevOps team.

## How to set up environment

1. Make sure to open the `tooling-dev` directory with the `Makefile`.
2. Run `make anvil` to run local Development node.
3. Run `make deploy-contracts` to deploy Shielder contract.
4. Run `make run-relayer`.

## Miscellaneous

- Node's default RPC URL is `http://localhost:8545`
- Contract default deployment address is `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318`
- Relayer's default URL is `http://localhost:4141`
- In order to faucet tokens to address in devnet node, call [`anvil_setBalance`](https://book.getfoundry.sh/reference/anvil/#custom-methods) with `cast` tool (you should have it if you properly installed `foundry`):

```
cast rpc --rpc-url anvil anvil_setBalance 0xE7616f8F030A611be722A7787Ce183FD78B941C9 123
```

- When something is not working, restart the env:
  - `make stop-anvil`
  - stop the docker container of relayer
  - re-run setup steps
