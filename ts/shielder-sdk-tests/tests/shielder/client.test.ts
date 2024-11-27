import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestUtils";
import type { Calldata, ShielderOperation } from "shielder-sdk/__internal__";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

sdkTest("new account, validate positive callbacks", async ({ workerPage }) => {
  const privateKeyAlice = generatePrivateKey();
  const aliceAddress = privateKeyToAddress(privateKeyAlice);

  const isGood = await workerPage.evaluate(
    async ({ privateKeyAlice, aliceAddress }) => {
      // setup
      const { contract, relayer, storage, publicClient, sendTx } =
        window.shielder.testUtils.mockedServices(aliceAddress);

      let calldataGenerated = false;

      const exampleTxHash = ("0x" + "0".repeat(64)) as `0x${string}`;
      let txHashSent = false;

      const shieldCallbacks = {
        onCalldataGenerated: (
          _calldata: Calldata,
          operation: ShielderOperation,
        ) => {
          if (operation == "shield") calldataGenerated = true;
        },
        onCalldataSent: (
          txHash: `0x${string}`,
          operation: ShielderOperation,
        ) => {
          if (operation == "shield" && txHash == exampleTxHash)
            txHashSent = true;
        },
      };
      const shielderClient = window.shielder.createShielderClientManually(
        privateKeyAlice,
        contract,
        relayer,
        storage,
        publicClient,
        shieldCallbacks,
      );
      contract.txHashToReturn = exampleTxHash;
      await shielderClient.shield(5n * 10n ** 18n, sendTx, aliceAddress);
      if (!calldataGenerated)
        throw new Error("Callback error: Calldata not generated");
      if (!txHashSent) throw new Error("Callback error: Tx not sent");
      return true;
    },
    { privateKeyAlice, aliceAddress },
  );
  expect(isGood).toBe(true);
});

sdkTest(
  "new account, validate error callback for sending error",
  async ({ workerPage }) => {
    const privateKeyAlice = generatePrivateKey();
    const aliceAddress = privateKeyToAddress(privateKeyAlice);

    const isGood = await workerPage.evaluate(
      async ({ privateKeyAlice, aliceAddress }) => {
        // setup
        const { contract, relayer, storage, publicClient, sendTx } =
          window.shielder.testUtils.mockedServices(aliceAddress);

        let calldataGenerated = false;

        let txHashSent = false;
        let isErrorEmitted = false;

        const shieldCallbacks = {
          onCalldataGenerated: (
            _calldata: Calldata,
            operation: ShielderOperation,
          ) => {
            if (operation == "shield") calldataGenerated = true;
          },
          onCalldataSent: (
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _txHash: `0x${string}`,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _operation: ShielderOperation,
          ) => {
            txHashSent = true;
          },
          onError: (
            error: unknown,
            stage: "generation" | "sending",
            operation: ShielderOperation,
          ) => {
            if (
              operation == "shield" &&
              stage == "sending" &&
              (error as Error).message.includes("No tx hash to return")
            )
              isErrorEmitted = true;
          },
        };
        const shielderClient = window.shielder.createShielderClientManually(
          privateKeyAlice,
          contract,
          relayer,
          storage,
          publicClient,
          shieldCallbacks,
        );
        // throw error at contract by not setting txHashToReturn
        try {
          await shielderClient.shield(5n * 10n ** 18n, sendTx, aliceAddress);
        } catch (e) {
          // do nothing
          if (!calldataGenerated)
            throw new Error("Callback error: Calldata not generated");
          if (txHashSent) throw new Error("Callback error: Tx not sent");
          if (!isErrorEmitted) throw new Error("Callback error: Tx not sent");
          return true;
        }
        throw new Error("shielderClient.shield should have thrown");
      },
      { privateKeyAlice, aliceAddress },
    );
    expect(isGood).toBe(true);
  },
);
