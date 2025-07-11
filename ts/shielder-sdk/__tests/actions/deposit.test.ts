import { beforeEach, describe, expect, it, vitest } from "vitest";
import {
  DepositAdvice,
  DepositPubInputs,
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { hashedNote, MockedCryptoClient } from "../helpers";

import { DepositAction } from "../../src/actions/deposit";
import { IContract } from "../../src/chain/contract";
import { SendShielderTransaction } from "../../src/client/types";
import { nativeToken } from "../../src/utils";
import { OutdatedSdkError } from "../../src/errors";
import { AccountStateMerkleIndexed } from "../../src/state/types";

describe("DepositAction", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: IContract;
  let action: DepositAction;
  let state: AccountStateMerkleIndexed;
  const stateNonce = 1n;
  const prevNullifier = Scalar.fromBigint(2n);
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;

  const mockedPath = [0n, 1n];
  let mockedMerkleRoot: Scalar;

  beforeEach(async () => {
    cryptoClient = new MockedCryptoClient();
    // merkle tree is mocked to be of height 1, arity 2
    mockedMerkleRoot = await cryptoClient.hasher.poseidonHash([
      Scalar.fromBigint(0n),
      Scalar.fromBigint(1n)
    ]);
    contract = {
      getAddress: vitest.fn().mockReturnValue(mockAddress),
      depositNativeCalldata: vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            oldNoteNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
            amount: bigint,
            proof: Uint8Array
          ) => Promise<{ calldata: `0x${string}`; gas: bigint }>
        >()
        .mockResolvedValue({ calldata: "0xmockedCalldata", gas: 123n }),
      getMerklePath: vitest
        .fn<(idx: bigint) => Promise<readonly bigint[]>>()
        .mockResolvedValue([...mockedPath, scalarToBigint(mockedMerkleRoot)])
    } as unknown as IContract;
    action = new DepositAction(contract, cryptoClient);
    const id = Scalar.fromBigint(123n);
    state = {
      id,
      nonce: stateNonce,
      balance: 5n,
      currentNote: await hashedNote(id, prevNullifier, Scalar.fromBigint(5n)),
      currentNoteIndex: 100n,
      token: nativeToken()
    };
  });

  describe("rawDeposit", () => {
    it("should transform an existing state", async () => {
      const amount = 100n;
      const expectedAmount = amount + state.balance;
      const result = await action.rawDeposit(state, amount);

      expect(result).not.toBeNull();
      if (!result) {
        throw new Error("result is null");
      }
      expect(result.balance).toBe(expectedAmount);
      expect(result.nonce).toBe(2n);
      // Nullifier should be secret manager's output
      const { nullifier: newNullifier } =
        await cryptoClient.secretManager.getSecrets(
          state.id,
          Number(state.nonce)
        );
      // Note should be hash of [version, id, nullifier, amount]
      const expectedNote = await hashedNote(
        state.id,
        newNullifier,
        Scalar.fromBigint(expectedAmount)
      );
      expect(scalarsEqual(result.currentNote, expectedNote)).toBe(true);
    });
  });

  describe("generateCalldata", () => {
    it("should generate valid calldata", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion,
        mockAddress
      );

      // Verify the proof
      const isValid = await cryptoClient.depositCircuit.verify(
        calldata.calldata.proof,
        calldata.calldata.pubInputs
      );
      expect(isValid).toBe(true);

      // Amount should be equal to input amount
      expect(calldata.amount).toBe(amount);

      // Expected contract version should be equal to input expected version
      expect(calldata.expectedContractVersion).toBe(expectedVersion);
    });

    it("should throw on incorrect merkle path length", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      contract.getMerklePath = vitest
        .fn<(idx: bigint) => Promise<readonly bigint[]>>()
        .mockResolvedValue([0n]);
      await expect(
        action.generateCalldata(state, amount, expectedVersion, mockAddress)
      ).rejects.toThrow("Wrong path length");
    });

    it("should throw on incorrect prover inputs", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;

      // mock cryptoClient to throw on cryptoClient.depositCircuit.prove
      cryptoClient.depositCircuit.prove = vitest
        .fn<
          (values: DepositAdvice<Scalar>) => Promise<{
            proof: Uint8Array;
            pubInputs: DepositPubInputs<Scalar>;
          }>
        >()
        .mockRejectedValue("error");

      await expect(
        action.generateCalldata(state, amount, expectedVersion, mockAddress)
      ).rejects.toThrow("Failed to prove deposit:");
    });

    it("should throw on failed verification", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;

      // mock cryptoClient to throw on cryptoClient.depositCircuit.prove
      cryptoClient.depositCircuit.verify = vitest
        .fn<
          (
            proof: Uint8Array,
            values: DepositPubInputs<Scalar>
          ) => Promise<boolean>
        >()
        .mockResolvedValue(false);

      await expect(
        action.generateCalldata(state, amount, expectedVersion, mockAddress)
      ).rejects.toThrow("Deposit proof verification failed");
    });
  });

  describe("sendCalldata", () => {
    it("should send transaction with correct parameters", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion,
        mockAddress
      );

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockResolvedValue("0xtxHash" as `0x${string}`);

      const txHash = await action.sendCalldata(
        calldata,
        mockSendTransaction,
        mockAddress
      );

      expect(contract.depositNativeCalldata).toHaveBeenCalledWith(
        expectedVersion,
        mockAddress,
        scalarToBigint(calldata.calldata.pubInputs.hNullifierOld),
        scalarToBigint(calldata.calldata.pubInputs.hNoteNew),
        scalarToBigint(calldata.calldata.pubInputs.merkleRoot),
        calldata.amount,
        scalarToBigint(calldata.calldata.pubInputs.macSalt),
        scalarToBigint(calldata.calldata.pubInputs.macCommitment),
        calldata.calldata.proof
      );

      expect(mockSendTransaction).toHaveBeenCalledWith({
        data: "0xmockedCalldata",
        to: mockAddress,
        value: amount,
        gas: 123n
      });

      expect(txHash).toBe("0xtxHash");
    });

    it("should throw on rejected contract version during simulation", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;

      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion,
        mockAddress
      );

      const mockedErr = new OutdatedSdkError("123");

      contract.depositNativeCalldata = vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            oldNoteNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
            amount: bigint,
            macSalt: bigint,
            macCommitment: bigint,
            proof: Uint8Array
          ) => Promise<{ calldata: `0x${string}`; gas: bigint }>
        >()
        .mockRejectedValue(mockedErr);

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockResolvedValue("0xtxHash" as `0x${string}`);

      await expect(
        action.sendCalldata(calldata, mockSendTransaction, mockAddress)
      ).rejects.toThrowError(mockedErr);
    });

    it("should throw on rejected contract version during sending", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion,
        mockAddress
      );

      const mockedErr = new OutdatedSdkError("123");

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockRejectedValue(mockedErr);

      await expect(
        action.sendCalldata(calldata, mockSendTransaction, mockAddress)
      ).rejects.toThrowError(mockedErr);
    });

    it("should throw on other errors during send", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion,
        mockAddress
      );

      const mockSendTransaction = vitest
        .fn<SendShielderTransaction>()
        .mockRejectedValue(new Error("some error"));

      await expect(
        action.sendCalldata(calldata, mockSendTransaction, mockAddress)
      ).rejects.toThrow("Failed to deposit: Error: some error");
    });
  });
});
