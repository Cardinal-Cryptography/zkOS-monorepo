import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CryptoClient,
  Scalar,
  scalarsEqual,
  scalarToBigint,
  WithdrawAdvice,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../../helpers";

import { WithdrawAction } from "../../../src/shielder/actions/withdraw";
import { AccountState } from "../../../src/shielder/state";
import { IContract } from "../../../src/chain/contract";
import {
  IRelayer,
  VersionRejectedByRelayer,
  WithdrawResponse
} from "../../../src/chain/relayer";
import { encodePacked, hexToBigInt, keccak256 } from "viem";
import { SendShielderTransaction } from "../../../src/shielder/client";

const pubInputsCorrect = async (
  pubInputs: WithdrawPubInputs,
  cryptoClient: CryptoClient,
  prevNullifier: Scalar,
  state: AccountState,
  amount: bigint,
  nonce: bigint,
  merkleRoot: Scalar,
  commitment: Scalar
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
        Scalar.fromBigint(state.balance - amount)
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

  // commitment should be equal to input commitment
  expect(scalarsEqual(pubInputs.commitment, commitment)).toBe(true);
};

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
      getAddress: jest.fn().mockReturnValue(mockAddress),
      depositCalldata: jest
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
      getMerklePath: jest
        .fn<(idx: bigint) => Promise<readonly bigint[]>>()
        .mockResolvedValue([...mockedPath, scalarToBigint(mockedMerkleRoot)])
    } as unknown as IContract;
    relayer = {
      address: jest
        .fn<() => Promise<`0x${string}`>>()
        .mockResolvedValue(mockRelayerAddress),
      withdraw: jest
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
    action = new WithdrawAction(contract, relayer, cryptoClient, {
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
      storageSchemaVersion: 0
    };
  });

  describe("rawWithdraw", () => {
    it("should create new account state with initial deposit", async () => {
      const amount = 2n;
      const expectedAmount = state.balance - amount;
      const result = await action.rawWithdraw(state, amount);

      expect(result).not.toBeNull();
      if (result) {
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
      }
    });
  });

  describe("preparePubInputs", () => {
    it("should prepare public inputs correctly", async () => {
      const amount = 2n;
      const nonce = 123n;
      const commitment = Scalar.fromBigint(3n);
      const merkleRoot = Scalar.fromBigint(4n);
      const pubInputs = await action.preparePubInputs(
        state,
        amount,
        Scalar.fromBigint(nonce),
        Scalar.fromBigint(2n),
        merkleRoot,
        commitment
      );

      await pubInputsCorrect(
        pubInputs,
        cryptoClient,
        prevNullifier,
        state,
        amount,
        nonce,
        merkleRoot,
        commitment
      );
    });

    it("should throw on negative balance", async () => {
      const amount = 6n;
      const nonce = 123n;
      const commitment = Scalar.fromBigint(3n);
      const merkleRoot = Scalar.fromBigint(4n);
      expect(
        action.preparePubInputs(
          state,
          amount,
          Scalar.fromBigint(nonce),
          prevNullifier,
          merkleRoot,
          commitment
        )
      ).rejects.toThrow(
        "Failed to withdraw, possibly due to insufficient balance"
      );
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
        totalFee,
        address,
        expectedVersion
      );

      const { nullifier } = await cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce - 1n)
      );

      // Verify the public inputs
      await pubInputsCorrect(
        calldata.calldata.pubInputs,
        cryptoClient,
        nullifier,
        state,
        amount,
        mockedIdHidingNonce,
        mockedMerkleRoot,
        Scalar.fromBigint(
          hexToBigInt(
            keccak256(
              encodePacked(
                ["bytes3", "uint256", "uint256", "uint256"],
                [
                  expectedVersion,
                  hexToBigInt(address),
                  hexToBigInt(mockRelayerAddress),
                  totalFee
                ]
              )
            )
          ) >> 4n
        )
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

      // Merkle root should be equal to input merkle root
      expect(
        scalarsEqual(calldata.calldata.pubInputs.merkleRoot, mockedMerkleRoot)
      ).toBe(true);
    });

    it("should throw on undefined currentNoteIndex", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      expect(
        action.generateCalldata(
          {
            ...state,
            currentNoteIndex: undefined
          },
          amount,
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
      expect(
        action.generateCalldata(
          state,
          amount,
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
      expect(
        action.generateCalldata(
          state,
          amount,
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

      cryptoClient.withdrawCircuit.prove = jest
        .fn<(values: WithdrawAdvice) => Promise<Uint8Array>>()
        .mockRejectedValue("error");

      expect(
        action.generateCalldata(
          state,
          amount,
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

      cryptoClient.withdrawCircuit.verify = jest
        .fn<
          (proof: Uint8Array, values: WithdrawPubInputs) => Promise<boolean>
        >()
        .mockResolvedValue(false);

      expect(
        action.generateCalldata(
          state,
          amount,
          totalFee,
          mockAddress,
          expectedVersion
        )
      ).rejects.toThrow("Withdrawal proof verification failed");
    });
  });

  describe("sendCalldata", () => {
    it("should send transaction with correct parameters", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      const calldata = await action.generateCalldata(
        state,
        amount,
        totalFee,
        mockAddress,
        expectedVersion
      );

      const txHash = await action.sendCalldata(calldata);

      expect(relayer.withdraw).toHaveBeenCalledWith(
        expectedVersion,
        scalarToBigint(calldata.calldata.pubInputs.idHiding),
        scalarToBigint(calldata.calldata.pubInputs.hNullifierOld),
        scalarToBigint(calldata.calldata.pubInputs.hNoteNew),
        scalarToBigint(calldata.calldata.pubInputs.merkleRoot),
        calldata.amount,
        calldata.calldata.proof,
        mockAddress
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
        totalFee,
        mockAddress,
        expectedVersion
      );

      const mockedErr = new VersionRejectedByRelayer("rejected version");

      relayer.withdraw = jest
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
        .mockRejectedValue(mockedErr);

      expect(action.sendCalldata(calldata)).rejects.toThrowError(mockedErr);
    });

    it("should throw on other errors during send", async () => {
      const amount = 2n;
      const expectedVersion = "0xversio" as `0x${string}`;
      const totalFee = 1n;
      const calldata = await action.generateCalldata(
        state,
        amount,
        totalFee,
        mockAddress,
        expectedVersion
      );

      relayer.withdraw = jest
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
        .mockRejectedValue(new Error("mocked contract rejection"));

      expect(action.sendCalldata(calldata)).rejects.toThrow(
        "Failed to withdraw: Error: mocked contract rejection"
      );
    });
  });
});
