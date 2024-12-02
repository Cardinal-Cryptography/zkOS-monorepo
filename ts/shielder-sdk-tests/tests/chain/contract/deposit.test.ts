import { expect, type JSHandle } from "@playwright/test";
import { getChainConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";
import { generatePrivateKey } from "viem/accounts";

import type {
  AccountState,
  DepositAction,
  DepositCalldata,
} from "shielder-sdk/__internal__";
import type { ContractTestFixture } from "@/chain/testUtils";

// Custom test that creates:
//  - `playwrightFixture`: an object initialized outside the browser environment,
//  - `webFixture`: a `JSHandle` to an object accessible only in the browser environment.
export const depositTest = sdkTest.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  playwrightFixture: async ({ }, use) => {
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
  privateKeyAlice: `0x${string}`;
};

type WebFixture = {
  contractTestFixture: ContractTestFixture;
  depositAction: DepositAction;
  stateAfterNewAccount: AccountState;
  depositCalldata: DepositCalldata;
  contractCalldata: `0x${string}`;
};

async function createPlaywrightFixture() {
  const chainConfig = getChainConfig();
  const privateKeyAlice = generatePrivateKey();

  return { chainConfig, privateKeyAlice };
}

async function createWebFixture({
  chainConfig,
  privateKeyAlice,
}: PlaywrightFixture) {
  const contractTestFixture = await window.chain.testUtils.setupContractTest(
    10n ** 18n,
    chainConfig,
    privateKeyAlice,
  );
  const { alicePublicAccount, contract, aliceSendTransaction, shielderClient } =
    contractTestFixture;
  const depositAction = window.shielder.actions.createDepositAction(contract);

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

  const depositCalldata = await depositAction.generateCalldata(
    stateAfterNewAccount,
    depositAmount,
    "0x000001",
  );

  const contractCalldata = await contract.depositCalldata(
    "0x000001",
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

  return {
    contractTestFixture,
    depositAction,
    stateAfterNewAccount,
    depositCalldata,
    contractCalldata,
  };
}

depositTest("succeeds", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({
      contractTestFixture,
      stateAfterNewAccount,
      depositCalldata,
      contractCalldata,
    }) => {
      const { alicePublicAccount, contract, aliceSendTransaction } =
        contractTestFixture;

      const depositTxHash = await aliceSendTransaction({
        data: contractCalldata,
        to: contract.getAddress(),
        value: depositCalldata.amount,
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
      if (depositEvent.amount !== depositCalldata.amount)
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
    webFixture,
  );
  expect(isGood).toBe(true);
});

depositTest("throws if bad calldata", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({ contractTestFixture, depositCalldata }) => {
      const { alicePublicAccount, contract } = contractTestFixture;
      try {
        await contract.depositCalldata(
          "0x000001",
          alicePublicAccount.account.address,
          window.crypto.scalar.scalarToBigint(
            depositCalldata.calldata.pubInputs.idHiding,
          ),
          window.crypto.scalar.scalarToBigint(
            depositCalldata.calldata.pubInputs.hNullifierOld,
          ),
          window.crypto.scalar.scalarToBigint(
            depositCalldata.calldata.pubInputs.hNoteNew,
          ) + 1n, // introduce error
          window.crypto.scalar.scalarToBigint(
            depositCalldata.calldata.pubInputs.merkleRoot,
          ),
          depositCalldata.amount,
          depositCalldata.calldata.proof,
        );
      } catch (e) {
        return (e as Error).message.includes(
          'The contract function "depositNative" reverted.',
        );
      }
      return false;
    },
    webFixture,
  );
  expect(isGood).toBe(true);
});

depositTest(
  "throws correct exception if deposit call dry-run receives wrong version",
  async ({ workerPage, webFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({ contractTestFixture, depositCalldata }) => {
        const { alicePublicAccount, contract } = contractTestFixture;
        try {
          await contract.depositCalldata(
            "0x000000", // introduce error
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
            depositCalldata.amount,
            depositCalldata.calldata.proof,
          );
        } catch (e) {
          return (
            e instanceof Error && e.message == "Version rejected by contract"
          );
        }

        return false;
      },
      webFixture,
    );
    expect(isGood).toBe(true);
  },
);
