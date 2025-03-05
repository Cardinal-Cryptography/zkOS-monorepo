import { beforeEach, describe, expect, it, vitest } from "vitest";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint,
  WithdrawAdvice,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../helpers";

import { WithdrawAction } from "../../src/actions/withdraw";
import { AccountState } from "../../src/state";
import { IContract } from "../../src/chain/contract";
import {
  IRelayer,
  VersionRejectedByRelayer,
  WithdrawResponse
} from "../../src/chain/relayer";
import { nativeToken, Token } from "../../src/types";

describe("WithdrawAction", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: IContract;
  let relayer: IRelayer;
  let action: WithdrawAction;
  let state: AccountState;
  const stateNonce = 1n;
  const prevNullifier = Scalar.fromBigint(2n);
  const prevTrapdoor = Scalar.fromBigint(3n);
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const mockRelayerAddress =
    "0x0987654321098765432109876543210987654321" as `0x${string}`;

  const mockedPath = [0n, 1n];
  let mockedMerkleRoot: Scalar;

  const mockedIdHidingNonce = 4n;

  beforeEach(async () => {
    cryptoClient = new MockedCryptoClient();
    mockedMerkleRoot = await cryptoClient.hasher.poseidonHash([
      Scalar.fromBigint(0n),
      Scalar.fromBigint(1n)
    ]);
    contract = {
      getAddress: vitest.fn().mockReturnValue(mockAddress),
      depositCalldata: vitest
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
    relayer = {
      address: vitest
        .fn<() => Promise<`0x${string}`>>()
        .mockResolvedValue(mockRelayerAddress),
      withdraw: vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            idHiding: bigint,
            oldNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
            amount: bigint,
            proof: Uint8Array,
            withdrawAddress: `0x${string}`
          ) => Promise<WithdrawResponse>
        >()
        .mockResolvedValue({
          tx_hash: "0xtxHash" as `0x${string}`
        })
    } as unknown as IRelayer;
    action = new WithdrawAction(
      contract,
      relayer,
      cryptoClient,
      {
        randomIdHidingNonce: () => Scalar.fromBigint(mockedIdHidingNonce)
      },
      1n
    );

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

  describe("rawWithdraw", () => {
    it("should transform an existing state", async () => {
      const amount = 2n;
      const expectedAmount = state.balance - amount;
      const result = await action.rawWithdraw(state, amount);

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

  describe("generateCalldata", () => {
    it("should generate valid calldata", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const address =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const totalFee = 1n;
      const calldata = await action.generateCalldata(
        state,
        amount,
        mockRelayerAddress,
        totalFee,
        address,
        expectedVersion
      );

      // Verify the proof
      const isValid = await cryptoClient.withdrawCircuit.verify(
        calldata.calldata.proof,
        calldata.calldata.pubInputs
      );
      expect(isValid).toBe(true);

      // Amount should be equal to input amount
      expect(calldata.amount).toBe(amount);

      // Expected contract version should be equal to input expected version
      expect(calldata.expectedContractVersion).toBe(expectedVersion);
    });

    it("should throw on undefined currentNoteIndex", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      await expect(
        action.generateCalldata(
          {
            ...state,
            currentNoteIndex: undefined
          },
          amount,
          mockRelayerAddress,
          totalFee,
          mockAddress,
          expectedVersion
        )
      ).rejects.toThrow("currentNoteIndex must be set");
    });

    it("should throw on balance less than amount", async () => {
      const amount = 6n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      await expect(
        action.generateCalldata(
          state,
          amount,
          mockRelayerAddress,
          totalFee,
          mockAddress,
          expectedVersion
        )
      ).rejects.toThrow("Insufficient funds");
    });

    it("should throw on amount less than fee", async () => {
      const amount = 1n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 2n;
      await expect(
        action.generateCalldata(
          state,
          amount,
          mockRelayerAddress,
          totalFee,
          mockAddress,
          expectedVersion
        )
      ).rejects.toThrow("Amount must be greater than the relayer fee: 2");
    });

    it("should throw on incorrect prover inputs", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;

      cryptoClient.withdrawCircuit.prove = vitest
        .fn<(values: WithdrawAdvice<Scalar>) => Promise<Uint8Array>>()
        .mockRejectedValue("error");

      await expect(
        action.generateCalldata(
          state,
          amount,
          mockRelayerAddress,
          totalFee,
          mockAddress,
          expectedVersion
        )
      ).rejects.toThrow("Failed to prove withdrawal:");
    });

    it("should throw on failed verification", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;

      cryptoClient.withdrawCircuit.verify = vitest
        .fn<
          (
            proof: Uint8Array,
            values: WithdrawPubInputs<Scalar>
          ) => Promise<boolean>
        >()
        .mockResolvedValue(false);

      await expect(
        action.generateCalldata(
          state,
          amount,
          mockRelayerAddress,
          totalFee,
          mockAddress,
          expectedVersion
        )
      ).rejects.toThrow("Withdrawal proof verification failed");
    });
  });

  describe("sendCalldataWithRelayer", () => {
    it("should send transaction with correct parameters", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      const calldata = await action.generateCalldata(
        state,
        amount,
        mockRelayerAddress,
        totalFee,
        mockAddress,
        expectedVersion
      );

      const txHash = await action.sendCalldataWithRelayer(calldata);

      expect(relayer.withdraw).toHaveBeenCalledWith(
        expectedVersion,
        nativeToken(),
        calldata.totalFee,
        scalarToBigint(calldata.calldata.pubInputs.idHiding),
        scalarToBigint(calldata.calldata.pubInputs.hNullifierOld),
        scalarToBigint(calldata.calldata.pubInputs.hNoteNew),
        scalarToBigint(calldata.calldata.pubInputs.merkleRoot),
        calldata.amount,
        calldata.calldata.proof,
        mockAddress,
        scalarToBigint(calldata.calldata.pubInputs.macSalt),
        scalarToBigint(calldata.calldata.pubInputs.macCommitment)
      );

      expect(txHash).toBe("0xtxHash");
    });

    it("should throw on rejected contract version", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      const calldata = await action.generateCalldata(
        state,
        amount,
        mockRelayerAddress,
        totalFee,
        mockAddress,
        expectedVersion
      );

      const mockedErr = new VersionRejectedByRelayer("rejected version");

      relayer.withdraw = vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            token: Token,
            feeAmount: bigint,
            idHiding: bigint,
            oldNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
            amount: bigint,
            proof: Uint8Array,
            withdrawalAddress: `0x${string}`,
            macSalt: bigint,
            macCommitment: bigint
          ) => Promise<WithdrawResponse>
        >()
        .mockRejectedValue(mockedErr);

      await expect(
        action.sendCalldataWithRelayer(calldata)
      ).rejects.toThrowError(mockedErr);
    });

    it("should throw on other errors during send", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      const calldata = await action.generateCalldata(
        state,
        amount,
        mockRelayerAddress,
        totalFee,
        mockAddress,
        expectedVersion
      );

      relayer.withdraw = vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            token: Token,
            feeAmount: bigint,
            idHiding: bigint,
            oldNullifierHash: bigint,
            newNote: bigint,
            merkleRoot: bigint,
            amount: bigint,
            proof: Uint8Array,
            withdrawalAddress: `0x${string}`,
            macSalt: bigint,
            macCommitment: bigint
          ) => Promise<WithdrawResponse>
        >()
        .mockRejectedValue(new Error("mocked contract rejection"));

      await expect(action.sendCalldataWithRelayer(calldata)).rejects.toThrow(
        "Failed to withdraw: Error: mocked contract rejection"
      );
    });
  });
});
