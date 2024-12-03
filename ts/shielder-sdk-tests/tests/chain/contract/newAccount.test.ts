import { expect, type JSHandle } from "@playwright/test";
import { getChainConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";
import { generatePrivateKey } from "viem/accounts";

import {
  type AccountState,
  type NewAccountCalldata,
} from "shielder-sdk/__internal__";
import type { ContractTestFixture } from "@/chain/testUtils";

// Custom test that creates:
//  - `playwrightFixture`: an object initialized outside the browser environment,
//  - `webFixture`: a `JSHandle` to an object accessible only in the browser environment.
export const newAccountTest = sdkTest.extend<Fixtures>({
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
  privateKeyAlice: `0x${string}`;
};

type WebFixture = {
  contractTestFixture: ContractTestFixture;
  state: AccountState;
  newAccountCalldata: NewAccountCalldata;
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
  // setup
  const contractTestFixture = await window.chain.testUtils.setupContractTest(
    10n ** 18n,
    chainConfig,
    privateKeyAlice,
  );
  const { alicePublicAccount, contract } = contractTestFixture;
  const newAccountAction =
    window.shielder.actions.createNewAccountAction(contract);

  const amount = 5n;
  const state = await window.state.emptyAccountState(
    await window.wasmClientWorker
      .getWorker()
      .privateKeyToScalar(privateKeyAlice),
  );

  const newAccountCalldata = await newAccountAction.generateCalldata(
    state,
    amount,
    "0x000001",
  );
  const { proof, pubInputs } = newAccountCalldata.calldata;

  const contractCalldata = await contract.newAccountCalldata(
    newAccountCalldata.expectedContractVersion,
    alicePublicAccount.account.address,
    window.crypto.scalar.scalarToBigint(pubInputs.hNote),
    window.crypto.scalar.scalarToBigint(pubInputs.hId),
    amount,
    proof,
  );

  return {
    contractTestFixture,
    state,
    newAccountCalldata,
    contractCalldata,
  };
}

newAccountTest("succeeds", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({
      contractTestFixture,
      state,
      newAccountCalldata,
      contractCalldata,
    }) => {
      const { contract, alicePublicAccount, aliceSendTransaction } =
        contractTestFixture;

      const txHash = await aliceSendTransaction({
        data: contractCalldata,
        to: contract.getAddress(),
        value: newAccountCalldata.amount,
      });
      const receipt = await alicePublicAccount.waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.status !== "success") {
        throw new Error("Transaction failed");
      }

      const event = await window.chain.testUtils.getValidatedEvent(
        contract,
        state,
        receipt.blockNumber,
        newAccountCalldata.amount,
        newAccountCalldata.calldata.pubInputs.hNote,
      );
      await window.chain.testUtils.getValidatedMerklePath(
        event.newNoteIndex,
        contract,
        newAccountCalldata.calldata.pubInputs.hNote,
      );
      return true;
    },
    webFixture,
  );
  expect(isGood).toBe(true);
});

newAccountTest("handles bad calldata", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({ contractTestFixture, newAccountCalldata }) => {
      const { contract, alicePublicAccount } = contractTestFixture;

      try {
        await contract.newAccountCalldata(
          newAccountCalldata.expectedContractVersion,
          alicePublicAccount.account.address,
          window.crypto.scalar.scalarToBigint(
            newAccountCalldata.calldata.pubInputs.hNote,
          ),
          window.crypto.scalar.scalarToBigint(
            newAccountCalldata.calldata.pubInputs.hId,
          ),
          newAccountCalldata.amount + 1n, // introduce error
          newAccountCalldata.calldata.proof,
        );
      } catch (err) {
        return (err as Error).message.includes(
          'The contract function "newAccountNative" reverted.',
        );
      }

      return false;
    },
    webFixture,
  );
  expect(isGood).toBe(true);
});

newAccountTest(
  "throws correct exception if newAccount dry run reverts due to wrong version",
  async ({ workerPage, webFixture }) => {
    const isGood = await workerPage.evaluate(
      async ({ contractTestFixture, newAccountCalldata }) => {
        const { contract, alicePublicAccount } = contractTestFixture;

        try {
          await contract.newAccountCalldata(
            "0x000000", // wrong version
            alicePublicAccount.account.address,
            window.crypto.scalar.scalarToBigint(
              newAccountCalldata.calldata.pubInputs.hNote,
            ),
            window.crypto.scalar.scalarToBigint(
              newAccountCalldata.calldata.pubInputs.hId,
            ),
            newAccountCalldata.amount,
            newAccountCalldata.calldata.proof,
          );
        } catch (err) {
          return (err as Error).message == "Version rejected by contract";
        }

        return false;
      },
      webFixture,
    );
    expect(isGood).toBe(true);
  },
);
