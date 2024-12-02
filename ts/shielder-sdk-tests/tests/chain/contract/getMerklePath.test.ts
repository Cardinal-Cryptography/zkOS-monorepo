import { expect, type JSHandle } from "@playwright/test";
import { getChainConfig } from "@tests/chain/config";
import { sdkTest } from "@tests/playwrightTestUtils";
import { generatePrivateKey } from "viem/accounts";

import type { Contract, Scalar } from "shielder-sdk/__internal__";

// Custom test that creates:
//  - `playwrightFixture`: an object initialized outside the browser environment,
//  - `webFixture`: a `JSHandle` to an object accessible only in the browser environment.
export const getMerklePathTest = sdkTest.extend<Fixtures>({
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
  contract: Contract;
  newNoteIndex: bigint;
  hNote: Scalar;
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
  const { alicePublicAccount, contract, aliceSendTransaction } =
    await window.chain.testUtils.setupContractTest(
      10n ** 18n,
      chainConfig,
      privateKeyAlice,
    );
  const newAccountAction =
    window.shielder.actions.createNewAccountAction(contract);

  const amount = 5n;
  const state = await window.state.emptyAccountState(privateKeyAlice);

  const newAccountCalldata = await newAccountAction.generateCalldata(
    state,
    amount,
    "0x000001",
  );
  const { proof, pubInputs } = newAccountCalldata.calldata;
  const hNote = pubInputs.hNote;

  const contractCalldata = await contract.newAccountCalldata(
    newAccountCalldata.expectedContractVersion,
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
    amount,
    hNote,
  );
  const newNoteIndex = event.newNoteIndex;

  return {
    contract,
    newNoteIndex,
    hNote,
  };
}

getMerklePathTest("succeeds", async ({ workerPage, webFixture }) => {
  const isGood = await workerPage.evaluate(
    async ({ contract, newNoteIndex, hNote }) => {
      await window.chain.testUtils.getValidatedMerklePath(
        newNoteIndex,
        contract,
        hNote,
      );
      return true;
    },
    webFixture,
  );
  expect(isGood).toBe(true);
});
