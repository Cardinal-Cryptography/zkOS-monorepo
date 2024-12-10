import { expect } from "@playwright/test";
import { getChainConfig, getRelayerConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";

import { generatePrivateKey } from "viem/accounts";

sdkTest("sync after withdraw w/ client", async ({ workerPage }) => {
  const chainConfig = getChainConfig();
  const relayerConfig = getRelayerConfig();
  const privateKeyAlice = generatePrivateKey();

  const isGood = await workerPage.evaluate(
    async ({ chainConfig, relayerConfig, privateKeyAlice }) => {
      // setup
      const { alicePublicAccount, shielderClient, aliceSendTransaction } =
        await window.chain.testUtils.setupContractTest(
          5n * 10n ** 18n,
          chainConfig,
          privateKeyAlice,
          relayerConfig,
        );

      const depositAmount = 2n * 10n ** 18n;
      await shielderClient.shield(
        depositAmount,
        aliceSendTransaction,
        alicePublicAccount.account.address,
      );

      if ((await shielderClient.accountState()).balance != depositAmount) {
        throw Error("Account state did not sync after deposit");
      }

      const withdrawAmount = 10n ** 18n;
      const addressTo = "0x0000000000000000000000000000000000000001";
      const quotedFees = await shielderClient.getWithdrawFees();
      await shielderClient.withdraw(
        withdrawAmount,
        quotedFees.totalFee,
        addressTo,
      );

      if (
        (await shielderClient.accountState()).balance !=
        depositAmount - withdrawAmount
      ) {
        throw Error("Account state did not sync after withdrawal");
      }
    },
    { chainConfig, relayerConfig, privateKeyAlice },
  );
  expect(isGood).toBe(true);
});

sdkTest("sync after withdraw w/o client", async ({ workerPage }) => {
  const chainConfig = getChainConfig();
  const relayerConfig = getRelayerConfig();
  const privateKeyAlice = generatePrivateKey();

  const isGood = await workerPage.evaluate(
    async ({ chainConfig, relayerConfig, privateKeyAlice }) => {
      // setup
      const {
        alicePublicAccount,
        shielderClient,
        aliceSendTransaction,
        relayer,
        contract,
      } = await window.chain.testUtils.setupContractTest(
        5n * 10n ** 18n,
        chainConfig,
        privateKeyAlice,
        relayerConfig,
      );

      const depositAmount = 2n * 10n ** 18n;
      await shielderClient.shield(
        depositAmount,
        aliceSendTransaction,
        alicePublicAccount.account.address,
      );

      const stateAfterNewAccount = await shielderClient.accountState();

      if (stateAfterNewAccount.balance != depositAmount) {
        throw Error("Account state did not sync after deposit");
      }

      // withdraw bypassing the shielder client
      const withdrawAmount = 10n ** 18n;
      const addressTo = "0x0000000000000000000000000000000000000001";
      const withdrawAction = window.shielder.actions.createWithdrawAction(
        contract,
        relayer!,
      );

      const quotedFees = await shielderClient.getWithdrawFees();
      const withdrawCalldata = await withdrawAction.generateCalldata(
        stateAfterNewAccount,
        withdrawAmount,
        quotedFees.totalFee,
        addressTo,
        "0x000001",
      );

      const withdrawResponse = await relayer!.withdraw(
        withdrawCalldata.expectedContractVersion,
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
          hash: withdrawResponse.tx_hash as `0x${string}`,
        });
      if (withdrawReceipt.status !== "success")
        throw new Error("Transaction failed");
      if ((await shielderClient.accountState()).balance != depositAmount) {
        throw Error("Account should not be synced");
      }
      await shielderClient.syncShielder();
      const stateAfterWithdraw = await shielderClient.accountState();
      if (stateAfterWithdraw.balance != depositAmount - withdrawAmount) {
        throw Error("Account state did not sync after withdraw");
      }
    },
    { chainConfig, relayerConfig, privateKeyAlice },
  );
  expect(isGood).toBe(true);
});
