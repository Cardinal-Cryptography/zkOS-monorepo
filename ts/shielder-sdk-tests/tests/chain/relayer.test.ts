import { expect } from "@playwright/test";
import { getChainConfig, getRelayerConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";
import { generatePrivateKey } from "viem/accounts";

sdkTest("withdraw after new account", async ({ workerPage }) => {
  const chainConfig = getChainConfig();
  const relayerConfig = getRelayerConfig();
  const privateKeyAlice = generatePrivateKey();

  const isGood = await workerPage.evaluate(
    async ({ chainConfig, relayerConfig, privateKeyAlice }) => {
      // setup
      const {
        alicePublicAccount,
        contract,
        relayer,
        shielderClient,
        aliceSendTransaction,
      } = await window.chain.testUtils.setupContractTest(
        5n * 10n ** 18n,
        chainConfig,
        privateKeyAlice,
        relayerConfig,
      );
      const withdrawAction = window.shielder.actions.createWithdrawAction(
        contract,
        relayer!,
      );

      // create new account with initial deposit of 2 coins
      const initialDepositAmount = 2n * 10n ** 18n;
      const newAccountTxHash = await shielderClient.shield(
        initialDepositAmount,
        aliceSendTransaction,
        alicePublicAccount.account.address,
      );
      await alicePublicAccount.waitForTransactionReceipt({
        hash: newAccountTxHash,
      });
      await shielderClient.syncShielder();
      const stateAfterNewAccount = await shielderClient.accountState();

      // withdraw 1 coin
      const withdrawAmount = 10n ** 18n;
      const addressTo = "0x0000000000000000000000000000000000000001";

      const withdrawCalldata = await withdrawAction.generateCalldata(
        stateAfterNewAccount,
        withdrawAmount,
        addressTo,
      );

      const withdrawResponse = await relayer!.withdraw(
        window.crypto.scalar.scalarToBigint(
          withdrawCalldata.calldata.pubInputs.idHiding,
        ),
        window.crypto.scalar.scalarToBigint(
          withdrawCalldata.calldata.pubInputs.hNullifierOld,
        ),
        window.crypto.scalar.scalarToBigint(
          withdrawCalldata.calldata.pubInputs.hNoteNew,
        ),
        window.crypto.scalar.scalarToBigint(
          withdrawCalldata.calldata.pubInputs.merkleRoot,
        ),
        withdrawCalldata.amount,
        withdrawCalldata.calldata.proof,
        withdrawCalldata.address,
      );
      const withdrawReceipt =
        await alicePublicAccount.waitForTransactionReceipt({
          hash: withdrawResponse.tx_hash,
        });
      if (withdrawReceipt.status !== "success")
        throw new Error("Transaction failed");
      return true;
    },
    { chainConfig, relayerConfig, privateKeyAlice },
  );
  expect(isGood).toBe(true);
});

sdkTest(
  "withdraw after new account failure (bad calldata)",
  async ({ workerPage }) => {
    const chainConfig = getChainConfig();
    const relayerConfig = getRelayerConfig();
    const privateKeyAlice = generatePrivateKey();

    const isGood = await workerPage.evaluate(
      async ({ chainConfig, relayerConfig, privateKeyAlice }) => {
        // setup
        const {
          alicePublicAccount,
          contract,
          relayer,
          shielderClient,
          aliceSendTransaction,
        } = await window.chain.testUtils.setupContractTest(
          5n * 10n ** 18n,
          chainConfig,
          privateKeyAlice,
          relayerConfig,
        );
        const withdrawAction = window.shielder.actions.createWithdrawAction(
          contract,
          relayer!,
        );

        // create new account with initial deposit of 2 coins
        const initialDepositAmount = 2n * 10n ** 18n;
        const newAccountTxHash = await shielderClient.shield(
          initialDepositAmount,
          aliceSendTransaction,
          alicePublicAccount.account.address,
        );
        await alicePublicAccount.waitForTransactionReceipt({
          hash: newAccountTxHash,
        });
        await shielderClient.syncShielder();
        const stateAfterNewAccount = await shielderClient.accountState();

        // withdraw 1 coin
        const withdrawAmount = 10n ** 18n;
        const addressTo = "0x0000000000000000000000000000000000000001";

        const withdrawCalldata = await withdrawAction.generateCalldata(
          stateAfterNewAccount,
          withdrawAmount,
          addressTo,
        );

        try {
          await relayer!.withdraw(
            window.crypto.scalar.scalarToBigint(
              withdrawCalldata.calldata.pubInputs.idHiding,
            ),
            window.crypto.scalar.scalarToBigint(
              withdrawCalldata.calldata.pubInputs.hNullifierOld,
            ),
            // Bad calldata
            window.crypto.scalar.scalarToBigint(
              withdrawCalldata.calldata.pubInputs.hNoteNew,
            ) + 1n,
            window.crypto.scalar.scalarToBigint(
              withdrawCalldata.calldata.pubInputs.merkleRoot,
            ),
            withdrawCalldata.amount,
            withdrawCalldata.calldata.proof,
            withdrawCalldata.address,
          );
        } catch (e: unknown) {
          if ((e as Error).message.includes("Failed to withdraw")) return true;
          throw new Error("Incorrect error message");
        }
        throw new Error("Transaction should have failed");
      },
      { chainConfig, relayerConfig, privateKeyAlice },
    );
    expect(isGood).toBe(true);
  },
);
