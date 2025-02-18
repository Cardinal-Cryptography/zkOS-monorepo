import { beforeEach, describe, expect, vitest, it } from "vitest";
import {
  CryptoClient,
  DepositAdvice,
  DepositPubInputs,
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../helpers";

import { DepositAction } from "../../src/actions/deposit";
import { AccountState } from "../../src/state";
import { IContract, VersionRejectedByContract } from "../../src/chain/contract";
import { SendShielderTransaction } from "../../src/client";
import { nativeToken } from "../../src/types";
import { nativeTokenAddress } from "../../src/constants";

const expectPubInputsCorrect = async (
  pubInputs: DepositPubInputs,
  cryptoClient: CryptoClient,
  prevNullifier: Scalar,
  state: AccountState,
  amount: bigint,
  nonce: bigint,
  merkleRoot: Scalar
) => {
  // hNullifierOld should be hash of nullifier
  expect(
    scalarsEqual(
      pubInputs.hNullifierOld,
      await cryptoClient.hasher.poseidonHash([prevNullifier])
    )
  ).toBe(true);

  // hNoteNew should be hash of [id, newNullifier, newTrapdoor, amount]
  const { nullifier: newNullifier, trapdoor: newTrapdoor } =
    await cryptoClient.secretManager.getSecrets(state.id, Number(state.nonce));
  expect(
    scalarsEqual(
      pubInputs.hNoteNew,
      await hashedNote(
        state.id,
        newNullifier,
        newTrapdoor,
        Scalar.fromBigint(state.balance + amount)
      )
    )
  ).toBe(true);

  // idHiding should be hash of [id hash, nonce]
  expect(
    scalarsEqual(
      pubInputs.idHiding,
      await cryptoClient.hasher.poseidonHash([
        await cryptoClient.hasher.poseidonHash([state.id]),
        Scalar.fromBigint(nonce)
      ])
    )
  ).toBe(true);

  // merkleRoot should be equal to input merkleRoot
  expect(scalarsEqual(pubInputs.merkleRoot, merkleRoot)).toBe(true);

  // value should be amount
  expect(scalarsEqual(pubInputs.value, Scalar.fromBigint(amount))).toBe(true);
};

describe("DepositAction", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: IContract;
  let action: DepositAction;
  let state: AccountState;
  const stateNonce = 1n;
  const prevNullifier = Scalar.fromBigint(2n);
  const prevTrapdoor = Scalar.fromBigint(3n);
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;

  const mockedPath = [0n, 1n];
  let mockedMerkleRoot: Scalar;

  const mockedIdHidingNonce = 4n;

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
            idHiding: bigint,
            oldNoteNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
            amount: bigint,
            proof: Uint8Array
          ) => Promise<`0x${string}`>
        >()
        .mockResolvedValue("0xmockedCalldata"),
      getMerklePath: vitest
        .fn<(idx: bigint) => Promise<readonly bigint[]>>()
        .mockResolvedValue([...mockedPath, scalarToBigint(mockedMerkleRoot)])
    } as unknown as IContract;
    action = new DepositAction(contract, cryptoClient, {
      randomIdHidingNonce: () => Scalar.fromBigint(mockedIdHidingNonce)
    });
    const id = Scalar.fromBigint(123n);
    state = {
      id,
      nonce: stateNonce,
      balance: 5n,
      currentNote: await hashedNote(
        id,
        prevNullifier,
        prevTrapdoor,
        Scalar.fromBigint(5n)
      ),
      currentNoteIndex: 100n,
      storageSchemaVersion: 0,
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
      // Nullifier and trapdoor should be secret manager's output
      const { nullifier: newNullifier, trapdoor: newTrapdoor } =
        await cryptoClient.secretManager.getSecrets(
          state.id,
          Number(state.nonce)
        );
      // Note should be hash of [version, id, nullifier, trapdoor, amount]
      const expectedNote = await hashedNote(
        state.id,
        newNullifier,
        newTrapdoor,
        Scalar.fromBigint(expectedAmount)
      );
      expect(scalarsEqual(result.currentNote, expectedNote)).toBe(true);
    });
  });

  describe("preparePubInputs", () => {
    it("should prepare public inputs correctly", async () => {
      const amount = 100n;
      const nonce = 123n;
      const merkleRoot = Scalar.fromBigint(3n);
      const pubInputs = await action.preparePubInputs(
        state,
        amount,
        Scalar.fromBigint(nonce),
        prevNullifier,
        merkleRoot,
        nativeTokenAddress
      );

      await expectPubInputsCorrect(
        pubInputs,
        cryptoClient,
        prevNullifier,
        state,
        amount,
        nonce,
        merkleRoot
      );
    });

    it("should throw on negative balance", async () => {
      const amount = -100n;
      const nonce = 123n;
      const merkleRoot = Scalar.fromBigint(3n);
      await expect(
        action.preparePubInputs(
          state,
          amount,
          Scalar.fromBigint(nonce),
          prevNullifier,
          merkleRoot,
          nativeTokenAddress
        )
      ).rejects.toThrow(
        "Failed to deposit, possibly due to insufficient balance"
      );
    });
  });

  describe("generateCalldata", () => {
    it("should generate valid calldata", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion
      );

      const { nullifier } = await cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce - 1n)
      );

      // Verify the public inputs
      await expectPubInputsCorrect(
        calldata.calldata.pubInputs,
        cryptoClient,
        nullifier,
        state,
        amount,
        mockedIdHidingNonce,
        mockedMerkleRoot
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

      // Merkle root should be equal to input merkle root
      expect(
        scalarsEqual(calldata.calldata.pubInputs.merkleRoot, mockedMerkleRoot)
      ).toBe(true);
    });

    it("should throw on undefined currentNoteIndex", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      await expect(
        action.generateCalldata(
          {
            ...state,
            currentNoteIndex: undefined
          },
          amount,
          expectedVersion
        )
      ).rejects.toThrow("currentNoteIndex must be set");
    });

    it("should throw on incorrect merkle path length", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      contract.getMerklePath = vitest
        .fn<(idx: bigint) => Promise<readonly bigint[]>>()
        .mockResolvedValue([0n]);
      await expect(
        action.generateCalldata(state, amount, expectedVersion)
      ).rejects.toThrow("Wrong path length");
    });

    it("should throw on incorrect prover inputs", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;

      // mock cryptoClient to throw on cryptoClient.depositCircuit.prove
      cryptoClient.depositCircuit.prove = vitest
        .fn<(values: DepositAdvice) => Promise<Uint8Array>>()
        .mockRejectedValue("error");

      await expect(
        action.generateCalldata(state, amount, expectedVersion)
      ).rejects.toThrow("Failed to prove deposit:");
    });

    it("should throw on failed verification", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;

      // mock cryptoClient to throw on cryptoClient.depositCircuit.prove
      cryptoClient.depositCircuit.verify = vitest
        .fn<(proof: Uint8Array, values: DepositPubInputs) => Promise<boolean>>()
        .mockResolvedValue(false);

      await expect(
        action.generateCalldata(state, amount, expectedVersion)
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

      expect(contract.depositNativeCalldata).toHaveBeenCalledWith(
        expectedVersion,
        mockAddress,
        scalarToBigint(calldata.calldata.pubInputs.idHiding),
        scalarToBigint(calldata.calldata.pubInputs.hNullifierOld),
        scalarToBigint(calldata.calldata.pubInputs.hNoteNew),
        scalarToBigint(calldata.calldata.pubInputs.merkleRoot),
        calldata.amount,
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
        state,
        amount,
        expectedVersion
      );

      const mockedErr = new VersionRejectedByContract();

      contract.depositNativeCalldata = vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            idHiding: bigint,
            oldNoteNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
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

    it("should throw on rejected contract version during sending", async () => {
      const amount = 100n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const calldata = await action.generateCalldata(
        state,
        amount,
        expectedVersion
      );

      const mockedErr = new VersionRejectedByContract();

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
        expectedVersion
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
