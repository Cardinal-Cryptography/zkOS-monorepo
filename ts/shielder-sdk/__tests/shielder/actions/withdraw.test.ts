import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../../helpers";

import { WithdrawAction } from "../../../src/shielder/actions/withdraw";
import { AccountState } from "../../../src/shielder/state";
import { IContract } from "../../../src/chain/contract";
import { IRelayer, WithdrawResponse } from "../../../src/chain/relayer";
import { SendShielderTransaction } from "../../../src/shielder/client";

describe("WithdrawAction", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: IContract;
  let relayer: IRelayer;
  let action: WithdrawAction;
  let state: AccountState;
  const nonce = 1n;
  const prevNullifier = Scalar.fromBigint(2n);
  const prevTrapdoor = Scalar.fromBigint(3n);
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const mockRelayerAddress =
    "0x0987654321098765432109876543210987654321" as `0x${string}`;

  beforeEach(async () => {
    cryptoClient = new MockedCryptoClient();
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
        .mockResolvedValue([
          0n,
          1n,
          scalarToBigint(
            await cryptoClient.hasher.poseidonHash([
              Scalar.fromBigint(0n),
              Scalar.fromBigint(1n)
            ])
          )
        ])
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
    action = new WithdrawAction(contract, relayer, cryptoClient);

    const id = Scalar.fromBigint(123n);
    state = {
      id,
      nonce,
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

  // describe("preparePubInputs", () => {
  //   it("should prepare public inputs correctly", async () => {
  //     const amount = 100n;
  //     const nonce = 123n;
  //     const commitment = Scalar.fromBigint(3n);
  //     const pubInputs = await action.preparePubInputs(
  //       state,
  //       amount,
  //       Scalar.fromBigint(nonce),
  //       Scalar.fromBigint(2n), //
  //       await cryptoClient.hasher.poseidonHash([Scalar.fromBigint(0n)]),
  //       commitment
  //     );

  //     // idHiding should be hash of [id hash, nonce]
  //     expect(
  //       scalarsEqual(
  //         pubInputs.idHiding,
  //         await cryptoClient.hasher.poseidonHash([
  //           await cryptoClient.hasher.poseidonHash([state.id]),
  //           Scalar.fromBigint(nonce)
  //         ])
  //       )
  //     ).toBe(true);

  //     // value should be amount
  //     expect(scalarsEqual(pubInputs.value, Scalar.fromBigint(amount))).toBe(
  //       true
  //     );

  //     const { nullifier: newNullifier, trapdoor: newTrapdoor } =
  //       await cryptoClient.secretManager.getSecrets(
  //         state.id,
  //         Number(state.nonce)
  //       );
  //     expect(
  //       scalarsEqual(
  //         pubInputs.hNoteNew,
  //         await hashedNote(
  //           state.id,
  //           newNullifier,
  //           newTrapdoor,
  //           Scalar.fromBigint(state.balance + amount)
  //         )
  //       )
  //     ).toBe(true);
  //   });
  // });

  // describe("generateCalldata", () => {
  //   it("should generate valid calldata", async () => {
  //     const amount = 100n;
  //     const expectedVersion = "0xversion" as `0x${string}`;
  //     const calldata = await action.generateCalldata(
  //       state,
  //       amount,
  //       expectedVersion
  //     );

  //     expect(calldata.amount).toBe(amount);
  //     expect(calldata.expectedContractVersion).toBe(expectedVersion);

  //     // Verify the proof
  //     const isValid = await cryptoClient.depositCircuit.verify(
  //       calldata.calldata.proof,
  //       calldata.calldata.pubInputs
  //     );
  //     expect(isValid).toBe(true);
  //   });
  // });

  // describe("sendCalldata", () => {
  //   it("should send transaction with correct parameters", async () => {
  //     const amount = 100n;
  //     const expectedVersion = "0xversio" as `0x${string}`;
  //     const calldata = await action.generateCalldata(
  //       state,
  //       amount,
  //       expectedVersion
  //     );

  //     const mockSendTransaction = jest
  //       .fn<SendShielderTransaction>()
  //       .mockResolvedValue("0xtxHash" as `0x${string}`);

  //     const txHash = await action.sendCalldata(
  //       calldata,
  //       mockSendTransaction,
  //       mockAddress
  //     );

  //     expect(contract.depositCalldata).toHaveBeenCalledWith(
  //       expectedVersion,
  //       mockAddress,
  //       scalarToBigint(calldata.calldata.pubInputs.idHiding),
  //       scalarToBigint(calldata.calldata.pubInputs.hNullifierOld),
  //       scalarToBigint(calldata.calldata.pubInputs.hNoteNew),
  //       scalarToBigint(calldata.calldata.pubInputs.merkleRoot),
  //       calldata.amount,
  //       calldata.calldata.proof
  //     );

  //     expect(mockSendTransaction).toHaveBeenCalledWith({
  //       data: "0xmockedCalldata",
  //       to: mockAddress,
  //       value: amount
  //     });

  //     expect(txHash).toBe("0xtxHash");
  //   });
  // });
});
