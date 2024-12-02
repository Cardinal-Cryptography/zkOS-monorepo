import type { ContractTestFixture } from "@/chain/testUtils";
import { expect, type JSHandle } from "@playwright/test";
import { getChainConfig, getRelayerConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";
import type {
  AccountState,
  WithdrawAction,
  WithdrawCalldata,
} from "shielder-sdk/__internal__";
import { generatePrivateKey } from "viem/accounts";

// Custom test that creates:
//  - `playwrightFixture`: an object initialized outside the browser environment,
//  - `webFixture`: a `JSHandle` to an object accessible only in the browser environment.
export const withdrawTest = sdkTest.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  playwrightFixture: async ({}, use) => {
    const playwrightFixture = await createPlaywrightFixture();
    await use(playwrightFixture);
  },

  webFixture: async ({ workerPage, playwrightFixture }, use) => {
    const webFixture = await workerPage.evaluateHandle(
      createWebFixture,
      playwrightFixture,
    );

    await use(webFixture);

    await webFixture.dispose();
  },
});

type Fixtures = {
  playwrightFixture: PlaywrightFixture;
  webFixture: JSHandle<WebFixture>;
};

type PlaywrightFixture = {
  chainConfig: ReturnType<typeof getChainConfig>;
  relayerConfig: ReturnType<typeof getRelayerConfig>;
  privateKeyAlice: `0x${string}`;
};

type WebFixture = {
  contractTestFixture: ContractTestFixture;
  withdrawAction: WithdrawAction;
  stateAfterNewAccount: AccountState;
  withdrawAmount: bigint;
  addressTo: `0x${string}`;
  withdrawCalldata: WithdrawCalldata;
};

async function createPlaywrightFixture() {
  const chainConfig = getChainConfig();
  const relayerConfig = getRelayerConfig();
  const privateKeyAlice = generatePrivateKey();

  return { chainConfig, relayerConfig, privateKeyAlice };
}

async function createWebFixture({
  chainConfig,
  relayerConfig,
  privateKeyAlice,
}: PlaywrightFixture) {
  const contractTestFixture = await window.chain.testUtils.setupContractTest(
    5n * 10n ** 18n,
    chainConfig,
    privateKeyAlice,
    relayerConfig,
  );
  const {
    alicePublicAccount,
    contract,
    relayer,
    shielderClient,
    aliceSendTransaction,
  } = contractTestFixture;

  const withdrawAction = window.shielder.actions.createWithdrawAction(
    contract,
    relayer!,
  );

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

  const withdrawAmount = 10n ** 18n;
  const addressTo: `0x${string}` = "0x0000000000000000000000000000000000000001";

  const withdrawCalldata = await withdrawAction.generateCalldata(
    stateAfterNewAccount,
    withdrawAmount,
    addressTo,
    "0x000001",
  );

  return {
    contractTestFixture,
    withdrawAction,
    stateAfterNewAccount,
    withdrawAmount,
    addressTo,
    withdrawCalldata,
  };
}

withdrawTest("succeeds", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({ contractTestFixture, withdrawCalldata }) => {
      const { alicePublicAccount, relayer } = contractTestFixture;

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
          hash: withdrawResponse.tx_hash,
        });
      if (withdrawReceipt.status !== "success")
        throw new Error("Transaction failed");
      return true;
    },
    webFixture,
  );
  expect(isGood).toBe(true);
});

withdrawTest("throws if bad calldata", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({ contractTestFixture, withdrawCalldata }) => {
      const { relayer } = contractTestFixture;

      try {
        await relayer!.withdraw(
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
          withdrawCalldata.amount + 1n, // bad calldata
          withdrawCalldata.calldata.proof,
          withdrawCalldata.address,
        );
      } catch (err) {
        return (err as Error).message.includes("Failed to withdraw");
      }
      return false;
    },
    webFixture,
  );
  expect(isGood).toBe(true);
});

withdrawTest(
  "throws correct error if relayer receives wrong version",
  async ({ workerPage, webFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({ contractTestFixture, withdrawCalldata }) => {
        const { relayer } = contractTestFixture;

        try {
          await relayer!.withdraw(
            "0x123456",
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
        } catch (err) {
          const expectedMessage =
            "Version rejected by relayer: " +
            '"Version mismatch: ' +
            'relayer expects 0x000001, client expects 0x123456"';
          return err instanceof Error && err.message == expectedMessage;
        }
        return false;
      },
      webFixture,
    );
    expect(isGood).toBe(true);
  },
);
