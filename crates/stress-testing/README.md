# Stress testing

Here you can find a binary that is used to check the performance of the Shielder components under high load.

## Scenario: parallel withdrawals through the relayer

### Description

1. Environment setup:
    - Run local anvil node (adjusted to the Aleph L2 network configuration).
    - Run local relayer service.
    - Endow relayer with enough funds to cover the withdrawal fees.
    - Endow one address with a lot of funds (contract deployer and balance distributor).
    - Deploy the Shielder contract suite.
2. Actor preparation:
    - Generate a set of `N` seeds (deterministically).
    - Endow each account with some funds.
    - Shield the funds with the `newAccount` method.
    - Prepare a relay query for each actor for a withdrawal action.
3. Pandemonium:
    - Each actor starts the withdrawal action in parallel.
    - The relayer processes the requests.
    - The actors check the status of their withdrawals.

Only phase 3. is executed in parallel. 
All previous steps are executed sequentially (proof generation etc. is fast enough).

### Running the test

```bash
make run
```

### Possible output:

```bash
✅ Generated actors (seeds and empty accounts)

⏳ Endowing actors with initial balance of 400000000000000000.
  ✅ Endowed address 0xB14d3c4F5FBFBCFB98af2d330000d49c95B93aA7
  ✅ Endowed address 0x735AA9fD4A3238902740E2126633B29adc0896aD
  ✅ Endowed address 0x405a71aa1BE3a43102dA91119dAe73267C8334b8
  ✅ Endowed address 0x761E600F0ec99064351505A5b28F57584FD6Bf6e
  ✅ Endowed address 0x77177b9884Bb7C6e6D6c955d4673A0Aec754915e
  ✅ Endowed address 0xd4C85D78c5951Ee926D798ABd2Bf0bD878334d3B
  ✅ Endowed address 0x9aB3496Db098fd8D6600925b5380DeB9E1C03fF3
  ✅ Endowed address 0x7535B677C8304D2C711E4E3f4aa23752ad2C30FD
  ✅ Endowed address 0x680B2BA0Cef2fe2570054Fd68E79B427A7A3C35b
  ✅ Endowed address 0x1AF505c471E2B579e3f0410ff7Cd6227909F8ceD
✅ Distributed tokens to actors

WARNING: using a default value seed for generating the SRS string
⏳ Creating shielder accounts. Every account will shield 300000000000000000.
  ✅ Shielded tokens for address 0xB14d3c4F5FBFBCFB98af2d330000d49c95B93aA7
  ✅ Shielded tokens for address 0x735AA9fD4A3238902740E2126633B29adc0896aD
  ✅ Shielded tokens for address 0x405a71aa1BE3a43102dA91119dAe73267C8334b8
  ✅ Shielded tokens for address 0x761E600F0ec99064351505A5b28F57584FD6Bf6e
  ✅ Shielded tokens for address 0x77177b9884Bb7C6e6D6c955d4673A0Aec754915e
  ✅ Shielded tokens for address 0xd4C85D78c5951Ee926D798ABd2Bf0bD878334d3B
  ✅ Shielded tokens for address 0x9aB3496Db098fd8D6600925b5380DeB9E1C03fF3
  ✅ Shielded tokens for address 0x7535B677C8304D2C711E4E3f4aa23752ad2C30FD
  ✅ Shielded tokens for address 0x680B2BA0Cef2fe2570054Fd68E79B427A7A3C35b
  ✅ Shielded tokens for address 0x1AF505c471E2B579e3f0410ff7Cd6227909F8ceD
✅ Actors have opened shielder accounts

WARNING: using a default value seed for generating the SRS string
⏳ Preparing relay queries for actors...
  ✅ Prepared relay query for actor 0
  ✅ Prepared relay query for actor 1
  ✅ Prepared relay query for actor 2
  ✅ Prepared relay query for actor 3
  ✅ Prepared relay query for actor 4
  ✅ Prepared relay query for actor 5
  ✅ Prepared relay query for actor 6
  ✅ Prepared relay query for actor 7
  ✅ Prepared relay query for actor 8
  ✅ Prepared relay query for actor 9
✅ Prepared relay queries (proof and REST calldata)

🎉 Entering pandemonium! 🎉
  🚀 Actor 0 is starting the withdrawal...
  🚀 Actor 1 is starting the withdrawal...
  🚀 Actor 2 is starting the withdrawal...
  🚀 Actor 3 is starting the withdrawal...
  🚀 Actor 4 is starting the withdrawal...
  🚀 Actor 5 is starting the withdrawal...
  🚀 Actor 6 is starting the withdrawal...
  🚀 Actor 7 is starting the withdrawal...
  🚀 Actor 8 is starting the withdrawal...
  🚀 Actor 9 is starting the withdrawal...
  ✅ Actor 7 succeeded! Latency: 710.880278ms.
  ✅ Actor 9 succeeded! Latency: 797.164413ms.
  ✅ Actor 5 succeeded! Latency: 809.240793ms.
  ✅ Actor 0 succeeded! Latency: 1.270915508s.
  ✅ Actor 8 succeeded! Latency: 1.365675006s.
  ✅ Actor 2 succeeded! Latency: 1.370372938s.
  ✅ Actor 6 succeeded! Latency: 1.858863171s.
  ✅ Actor 3 succeeded! Latency: 1.909160935s.
  ✅ Actor 1 succeeded! Latency: 1.909502682s.
  ✅ Actor 4 succeeded! Latency: 2.353088417s.
🎉 Pandemonium is over! 🎉

🎉 Successful withdrawals: 10/10
```
