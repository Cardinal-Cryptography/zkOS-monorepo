import { expect } from "@playwright/test";
import { getChainConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";
import { generatePrivateKey } from "viem/accounts";

sdkTest("new account and valid merkle path", async ({ workerPage }) => {
  const chainConfig = getChainConfig();
  const privateKeyAlice = generatePrivateKey();

  const isGood = await workerPage.evaluate(
    async ({ chainConfig, privateKeyAlice }) => {
      // setup
      const { alicePublicAccount, contract, aliceSendTransaction } =
        await window.chain.testUtils.setupContractTest(
          5n * 10n ** 18n,
          chainConfig,
          privateKeyAlice,
        );
      const newAccountAction =
        window.shielder.actions.createNewAccountAction(contract);

      // create new account with initial deposit of 5 coins
      const amount = 5n;
      const state = await window.state.emptyAccountState(privateKeyAlice);

      // generate calldata for new account action
      const newAccountCalldata = await newAccountAction.generateCalldata(
        state,
        amount,
      );
      const { proof, pubInputs } = newAccountCalldata.calldata;

      // send transaction to chain
      const contractCalldata = await contract.newAccountCalldata(
        alicePublicAccount.account.address,
        window.crypto.scalar.scalarToBigint(pubInputs.hNote),
        window.crypto.scalar.scalarToBigint(pubInputs.hId),
        amount,
        proof,
      );
      const txHash = await aliceSendTransaction({
        data: contractCalldata,
        to: contract.getAddress(),
        value: window.crypto.scalar.scalarToBigint(pubInputs.initialDeposit),
      }).catch((e) => {
        console.error(e);
        throw e;
      });
      const receipt = await alicePublicAccount.waitForTransactionReceipt({
        hash: txHash,
      });

      // if transaction failed, throw
      if (receipt.status !== "success") throw new Error("Transaction failed");

      // get event of new account creation
      const event = await window.chain.testUtils.getEvent(
        contract,
        state,
        receipt.blockNumber,
      );
      if (event.amount !== amount) throw new Error("Unexpected amount");
      if (
        event.newNote !== window.crypto.scalar.scalarToBigint(pubInputs.hNote)
      )
        throw new Error("Unexpected note");

      // get and validate merkle path
      await window.chain.testUtils.getValidatedMerklePath(
        event.newNoteIndex,
        contract,
        pubInputs.hNote,
      );
      return true;
    },
    { chainConfig, privateKeyAlice },
  );
  expect(isGood).toBe(true);
});

sdkTest("new account failure (bad calldata)", async ({ workerPage }) => {
  const chainConfig = getChainConfig();
  const privateKeyAlice = generatePrivateKey();

  const isGood = await workerPage.evaluate(
    async ({ chainConfig, privateKeyAlice }) => {
      // setup
      const { alicePublicAccount, contract, aliceSendTransaction } =
        await window.chain.testUtils.setupContractTest(
          5n * 10n ** 18n,
          chainConfig,
          privateKeyAlice,
        );
      const newAccountAction =
        window.shielder.actions.createNewAccountAction(contract);

      // create new account with initial deposit of 5 coins
      const amount = 5n;
      const state = await window.state.emptyAccountState(privateKeyAlice);

      // generate calldata for new account action
      const newAccountCalldata = await newAccountAction.generateCalldata(
        state,
        amount,
      );
      const { proof, pubInputs } = newAccountCalldata.calldata;

      // send transaction to chain
      try {
        const contractCalldata = await contract.newAccountCalldata(
          alicePublicAccount.account.address,
          window.crypto.scalar.scalarToBigint(pubInputs.hNote) + 1n,
          window.crypto.scalar.scalarToBigint(pubInputs.hId),
          amount,
          proof,
        );
        const txHash = await aliceSendTransaction({
          data: contractCalldata,
          to: contract.getAddress(),
          value: window.crypto.scalar.scalarToBigint(pubInputs.initialDeposit),
        }).catch((e) => {
          console.error(e);
          throw e;
        });
        const receipt = await alicePublicAccount.waitForTransactionReceipt({
          hash: txHash,
        });

        // if transaction failed, throw
        if (receipt.status !== "success") throw new Error("Transaction failed");
      } catch (e) {
        if (
          (e as Error).message.includes(
            'The contract function "newAccountNative" reverted.',
          )
        )
          return true;
        throw new Error("Incorrect error message");
      }
      throw new Error("Transaction should have failed");
    },
    { chainConfig, privateKeyAlice },
  );
  expect(isGood).toBe(true);
});

sdkTest("deposit after new account", async ({ workerPage }) => {
  const chainConfig = getChainConfig();
  const privateKeyAlice = generatePrivateKey();

  const isGood = await workerPage.evaluate(
    async ({ chainConfig, privateKeyAlice }) => {
      // setup
      const {
        alicePublicAccount,
        contract,
        aliceSendTransaction,
        shielderClient,
      } = await window.chain.testUtils.setupContractTest(
        5n * 10n ** 18n,
        chainConfig,
        privateKeyAlice,
      );
      const depositAction =
        window.shielder.actions.createDepositAction(contract);

      // create new account with initial deposit of 5 coins
      const initialDepositAmount = 5n;
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

      const depositAmount = 3n;
      // generate calldata for deposit action
      const depositCalldata = await depositAction.generateCalldata(
        stateAfterNewAccount,
        depositAmount,
      );

      // send deposit transaction to chain
      const contractCalldata = await contract.depositCalldata(
        alicePublicAccount.account.address,
        window.crypto.scalar.scalarToBigint(
          depositCalldata.calldata.pubInputs.idHiding,
        ),
        window.crypto.scalar.scalarToBigint(
          depositCalldata.calldata.pubInputs.hNullifierOld,
        ),
        window.crypto.scalar.scalarToBigint(
          depositCalldata.calldata.pubInputs.hNoteNew,
        ),
        window.crypto.scalar.scalarToBigint(
          depositCalldata.calldata.pubInputs.merkleRoot,
        ),
        depositAmount,
        depositCalldata.calldata.proof,
      );
      const depositTxHash = await aliceSendTransaction({
        data: contractCalldata,
        to: contract.getAddress(),
        value: depositAmount,
      }).catch((e) => {
        console.error(e);
        throw e;
      });
      const depositReceipt = await alicePublicAccount.waitForTransactionReceipt(
        {
          hash: depositTxHash,
        },
      );
      if (depositReceipt.status !== "success")
        throw new Error("Transaction failed");

      // get event of deposit
      const depositEvent = await window.chain.testUtils.getEvent(
        contract,
        stateAfterNewAccount,
        depositReceipt.blockNumber,
      );
      if (depositEvent.amount !== depositAmount)
        throw new Error("Unexpected amount");
      if (
        depositEvent.newNote !==
        window.crypto.scalar.scalarToBigint(
          depositCalldata.calldata.pubInputs.hNoteNew,
        )
      )
        throw new Error("Unexpected note");
      return true;
    },
    { chainConfig, privateKeyAlice },
  );
  expect(isGood).toBe(true);
});

sdkTest(
  "deposit after new account failure (bad calldata)",
  async ({ workerPage }) => {
    const chainConfig = getChainConfig();
    const privateKeyAlice = generatePrivateKey();

    const isGood = await workerPage.evaluate(
      async ({ chainConfig, privateKeyAlice }) => {
        // setup
        const {
          alicePublicAccount,
          contract,
          aliceSendTransaction,
          shielderClient,
        } = await window.chain.testUtils.setupContractTest(
          5n * 10n ** 18n,
          chainConfig,
          privateKeyAlice,
        );
        const depositAction =
          window.shielder.actions.createDepositAction(contract);

        // create new account with initial deposit of 5 coins
        const initialDepositAmount = 5n;
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

        const depositAmount = 3n;
        // generate calldata for deposit action
        const depositCalldata = await depositAction.generateCalldata(
          stateAfterNewAccount,
          depositAmount,
        );

        try {
          // send deposit transaction to chain
          const contractCalldata = await contract.depositCalldata(
            alicePublicAccount.account.address,
            window.crypto.scalar.scalarToBigint(
              depositCalldata.calldata.pubInputs.idHiding,
            ),
            window.crypto.scalar.scalarToBigint(
              depositCalldata.calldata.pubInputs.hNullifierOld,
            ),
            window.crypto.scalar.scalarToBigint(
              depositCalldata.calldata.pubInputs.hNoteNew,
            ) + 1n,
            window.crypto.scalar.scalarToBigint(
              depositCalldata.calldata.pubInputs.merkleRoot,
            ),
            depositAmount,
            depositCalldata.calldata.proof,
          );
          const depositTxHash = await aliceSendTransaction({
            data: contractCalldata,
            to: contract.getAddress(),
            value: depositAmount,
          }).catch((e) => {
            console.error(e);
            throw e;
          });
          const depositReceipt =
            await alicePublicAccount.waitForTransactionReceipt({
              hash: depositTxHash,
            });
          if (depositReceipt.status !== "success")
            throw new Error("Transaction failed");
        } catch (e) {
          if (
            (e as Error).message.includes(
              'The contract function "depositNative" reverted.',
            )
          )
            return true;
          throw new Error("Incorrect error message");
        }
        throw new Error("Transaction should have failed");
      },
      { chainConfig, privateKeyAlice },
    );
    expect(isGood).toBe(true);
  },
);
