import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestConfig";

sdkTest(
  "new account, validate positive callbacks",
  async ({ workerPage, globalConfigFixture, perTestConfigFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({
        globalConfigFixture: { chainConfig, relayerConfig, privateKeys },
        perTestConfigFixture: { shielderKeys }
      }) => {
        const initialDeposit = 2n;

        // setup
        const callbacksFixture = window.testFixtures.setupCallbacks();
        const { shielderClient, aliceSendTransaction, signerAccount } =
          await window.testFixtures.setupShielderClient(
            chainConfig,
            relayerConfig,
            privateKeys.alice,
            shielderKeys.alice,
            callbacksFixture.callbacks
          );
        const nativeToken = window.shielder.createNativeToken();
        await shielderClient.shield(
          nativeToken,
          initialDeposit,
          aliceSendTransaction,
          signerAccount.account.address
        );
        const accountState = await shielderClient.accountState(nativeToken);

        return (
          accountState.balance == initialDeposit &&
          callbacksFixture.calldataGeneratedHistory().length == 1 &&
          callbacksFixture.calldataSentHistory().length == 1 &&
          window.validators.validateTxHistory(callbacksFixture.txHistory(), [
            { type: "NewAccount", amount: initialDeposit }
          ])
        );
      },
      { globalConfigFixture, perTestConfigFixture }
    );
    expect(isGood).toBe(true);
  }
);

sdkTest(
  "new account, recover after state reset",
  async ({ workerPage, globalConfigFixture, perTestConfigFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({
        globalConfigFixture: { chainConfig, relayerConfig, privateKeys },
        perTestConfigFixture: { shielderKeys }
      }) => {
        const initialDeposit = 2n;

        // setup
        const callbacksFixture = window.testFixtures.setupCallbacks();
        const { shielderClient, aliceSendTransaction, signerAccount, storage } =
          await window.testFixtures.setupShielderClient(
            chainConfig,
            relayerConfig,
            privateKeys.alice,
            shielderKeys.alice,
            callbacksFixture.callbacks
          );
        const nativeToken = window.shielder.createNativeToken();
        await shielderClient.shield(
          nativeToken,
          initialDeposit,
          aliceSendTransaction,
          signerAccount.account.address
        );
        // clear state
        storage.clear();
        callbacksFixture.clearHistory();

        // recover
        await shielderClient.syncShielderToken(nativeToken);

        const accountState = await shielderClient.accountState(nativeToken);
        return (
          accountState.balance == initialDeposit &&
          window.validators.validateTxHistory(callbacksFixture.txHistory(), [
            { type: "NewAccount", amount: initialDeposit }
          ])
        );
      },
      {
        globalConfigFixture,
        perTestConfigFixture
      }
    );
    expect(isGood).toBe(true);
  }
);

sdkTest(
  "deposit after new account, validate positive callbacks",
  async ({ workerPage, globalConfigFixture, perTestConfigFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({
        globalConfigFixture: { chainConfig, relayerConfig, privateKeys },
        perTestConfigFixture: { shielderKeys }
      }) => {
        const initialDeposit = 2n;
        const depositAmount = 3n;

        // setup
        const callbacksFixture = window.testFixtures.setupCallbacks();
        const { shielderClient, aliceSendTransaction, signerAccount } =
          await window.testFixtures.setupShielderClient(
            chainConfig,
            relayerConfig,
            privateKeys.alice,
            shielderKeys.alice,
            callbacksFixture.callbacks
          );
        const nativeToken = window.shielder.createNativeToken();
        // create new account
        await shielderClient.shield(
          nativeToken,
          initialDeposit,
          aliceSendTransaction,
          signerAccount.account.address
        );

        // deposit
        await shielderClient.shield(
          nativeToken,
          depositAmount,
          aliceSendTransaction,
          signerAccount.account.address
        );

        const accountState = await shielderClient.accountState(nativeToken);

        return (
          accountState.balance == initialDeposit + depositAmount &&
          callbacksFixture.calldataGeneratedHistory().length == 2 &&
          callbacksFixture.calldataSentHistory().length == 2 &&
          window.validators.validateTxHistory(callbacksFixture.txHistory(), [
            { type: "NewAccount", amount: initialDeposit },
            { type: "Deposit", amount: depositAmount }
          ])
        );
      },
      { globalConfigFixture, perTestConfigFixture }
    );
    expect(isGood).toBe(true);
  }
);

sdkTest(
  "deposit after new account, recover after state reset",
  async ({ workerPage, globalConfigFixture, perTestConfigFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({
        globalConfigFixture: { chainConfig, relayerConfig, privateKeys },
        perTestConfigFixture: { shielderKeys }
      }) => {
        const initialDeposit = 2n;
        const depositAmount = 3n;

        // setup
        const callbacksFixture = window.testFixtures.setupCallbacks();
        const { shielderClient, aliceSendTransaction, signerAccount, storage } =
          await window.testFixtures.setupShielderClient(
            chainConfig,
            relayerConfig,
            privateKeys.alice,
            shielderKeys.alice,
            callbacksFixture.callbacks
          );
        const nativeToken = window.shielder.createNativeToken();
        // create new account
        await shielderClient.shield(
          nativeToken,
          initialDeposit,
          aliceSendTransaction,
          signerAccount.account.address
        );
        // deposit
        await shielderClient.shield(
          nativeToken,
          depositAmount,
          aliceSendTransaction,
          signerAccount.account.address
        );

        // clear state
        storage.clear();
        callbacksFixture.clearHistory();
        // recover
        await shielderClient.syncShielderToken(nativeToken);

        const accountState = await shielderClient.accountState(nativeToken);
        return (
          accountState.balance == initialDeposit + depositAmount &&
          window.validators.validateTxHistory(callbacksFixture.txHistory(), [
            { type: "NewAccount", amount: initialDeposit },
            { type: "Deposit", amount: depositAmount }
          ])
        );
      },
      { globalConfigFixture, perTestConfigFixture }
    );
    expect(isGood).toBe(true);
  }
);
