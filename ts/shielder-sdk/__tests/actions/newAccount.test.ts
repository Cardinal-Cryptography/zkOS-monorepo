import { beforeEach, describe, expect, it, vitest } from "vitest";
import {
  CryptoClient,
  NewAccountAdvice,
  NewAccountPubInputs,
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../helpers";

import { NewAccountAction } from "../../src/actions/newAccount";
import { AccountState } from "../../src/state";
import { IContract, VersionRejectedByContract } from "../../src/chain/contract";
import { SendShielderTransaction } from "../../src/client";

const expectPubInputsCorrect = async (
  pubInputs: NewAccountPubInputs,
  state: AccountState,
  amount: bigint,
  cryptoClient: CryptoClient
) => {
  // hId should be hash of id
  expect(
    scalarsEqual(
      pubInputs.hId,
      await cryptoClient.hasher.poseidonHash([state.id])
    )
  ).toBe(true);

  expect(
    scalarsEqual(pubInputs.initialDeposit, Scalar.fromBigint(amount))
  ).toBe(true);

  const { nullifier, trapdoor } = await cryptoClient.secretManager.getSecrets(
    state.id,
    Number(state.nonce)
  );
  expect(
    scalarsEqual(
      pubInputs.hNote,
      await hashedNote(state.id, nullifier, trapdoor, Scalar.fromBigint(amount))
    )
  ).toBe(true);
};

describe("NewAccountAction", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: IContract;
  let action: NewAccountAction;
  let mockedState: AccountState;

  const mockedStateNonce = 0n;
  const mockedId = Scalar.fromBigint(123n);
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    contract = {
      getAddress: vitest.fn().mockReturnValue(mockAddress),
      newAccountCalldata: vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            newNote: bigint,
            idHash: bigint,
            amount: bigint,
            proof: Uint8Array
          ) => Promise<`0x${string}`>
        >()
        .mockResolvedValue("0xmockedCalldata")
    } as unknown as IContract;
    action = new NewAccountAction(contract, cryptoClient);
    mockedState = {
      id: mockedId,
      nonce: mockedStateNonce,
      balance: 0n,
      currentNote: Scalar.fromBigint(0n),
      storageSchemaVersion: 0
    };
  });

  describe("rawNewAccount", () => {
    it("should create new account state with initial deposit", async () => {
      const amount = 100n;
      const result = await action.rawNewAccount(mockedState, amount);

      expect(result).not.toBeNull();
      if (!result) {
        throw new Error("result is null");
      }
      expect(result.balance).toBe(amount);
      expect(result.nonce).toBe(mockedStateNonce + 1n);
      // Nullifier and trapdoor should be secret manager's output
      const { nullifier, trapdoor } =
        await cryptoClient.secretManager.getSecrets(
          mockedState.id,
          Number(mockedState.nonce)
        );
      // Note should be hash of [version, id, nullifier, trapdoor, amount]
      const expectedNote = await hashedNote(
        mockedState.id,
        nullifier,
        trapdoor,
        Scalar.fromBigint(amount)
      );
      expect(scalarsEqual(result.currentNote, expectedNote)).toBe(true);
    });
  });

  describe("preparePubInputs", () => {
    it("should prepare public inputs correctly", async () => {
      const amount = 100n;
      const pubInputs = await action.preparePubInputs(mockedState, amount);

      await expectPubInputsCorrect(
        pubInputs,
        mockedState,
        amount,
        cryptoClient
      );
    });

    it("should throw an error at negative amount", async () => {
      const amount = -100n;
      await expect(
        action.preparePubInputs(mockedState, amount)
      ).rejects.toThrow(
        "Failed to create new account, possibly due to negative balance"
      );
    });
  });

  describe("generateCalldata", () => {
    it("should generate valid calldata", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      const calldata = await action.generateCalldata(
        mockedState,
        amount,
        expectedVersion
      );

      // Verify the public inputs
      await expectPubInputsCorrect(
        calldata.calldata.pubInputs,
        mockedState,
        amount,
        cryptoClient
      );

      // Verify the proof
      const isValid = await cryptoClient.newAccountCircuit.verify(
        calldata.calldata.proof,
        calldata.calldata.pubInputs
      );
      expect(isValid).toBe(true);

      expect(calldata.amount).toBe(amount);
      expect(calldata.expectedContractVersion).toBe(expectedVersion);
    });

    it("should throw an error at proving failure", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      const mockProve = vitest
        .fn<(values: NewAccountAdvice) => Promise<Uint8Array>>()
        .mockRejectedValue(new Error("mocked prove failure"));
      cryptoClient.newAccountCircuit.prove = mockProve;

      await expect(
        action.generateCalldata(mockedState, amount, expectedVersion)
      ).rejects.toThrow(
        "Failed to prove new account: Error: mocked prove failure"
      );
    });

    it("should throw an error at verification failure", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      const mockVerify = vitest
        .fn<
          (
            proof: Uint8Array,
            pubInputs: NewAccountPubInputs
          ) => Promise<boolean>
        >()
        .mockResolvedValue(false);
      cryptoClient.newAccountCircuit.verify = mockVerify;

      await expect(
        action.generateCalldata(mockedState, amount, expectedVersion)
      ).rejects.toThrow("New account proof verification failed");
    });
  });

  describe("sendCalldata", () => {
    it("should send transaction with correct parameters", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        mockedState,
        amount,
        expectedVersion
      );

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockResolvedValue("0xtxHash" as `0x${string}`);

      const txHash = await action.sendCalldata(
        calldata,
        mockSendTransaction,
        mockAddress
      );

      expect(contract.newAccountCalldata).toHaveBeenCalledWith(
        expectedVersion,
        mockAddress,
        scalarToBigint(calldata.calldata.pubInputs.hNote),
        scalarToBigint(calldata.calldata.pubInputs.hId),
        amount,
        calldata.calldata.proof
      );

      expect(mockSendTransaction).toHaveBeenCalledWith({
        data: "0xmockedCalldata",
        to: mockAddress,
        value: amount
      });

      expect(txHash).toBe("0xtxHash");
    });

    it("should throw on rejected contract version during simulation", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        mockedState,
        amount,
        expectedVersion
      );

      const mockedErr = new VersionRejectedByContract();

      contract.newAccountCalldata = vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            newNote: bigint,
            idHash: bigint,
            amount: bigint,
            proof: Uint8Array
          ) => Promise<`0x${string}`>
        >()
        .mockRejectedValue(mockedErr);

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockResolvedValue("0xtxHash" as `0x${string}`);

      await expect(
        action.sendCalldata(calldata, mockSendTransaction, mockAddress)
      ).rejects.toThrowError(mockedErr);
    });

    it("should throw an error at sending errors", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        mockedState,
        amount,
        expectedVersion
      );

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockRejectedValue(new Error("mocked contract rejection"));

      await expect(
        action.sendCalldata(calldata, mockSendTransaction, mockAddress)
      ).rejects.toThrow(
        "Failed to create new account: Error: mocked contract rejection"
      );
    });
  });
});
