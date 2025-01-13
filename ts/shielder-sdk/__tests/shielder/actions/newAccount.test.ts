import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Scalar, scalarsEqual, scalarToBigint } from "shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../../helpers";

import { NewAccountAction } from "../../../src/shielder/actions/newAccount";
import { AccountState } from "../../../src/shielder/state";
import { IContract } from "../../../src/chain/contract";
import { SendShielderTransaction } from "../../../src/shielder/client";

describe("NewAccountAction", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: IContract;
  let action: NewAccountAction;
  let state: AccountState;
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as `0x${string}`;

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    contract = {
      getAddress: jest.fn().mockReturnValue(mockAddress),
      newAccountCalldata: jest
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
    state = {
      id: Scalar.fromBigint(123n),
      nonce: 0n,
      balance: 0n,
      currentNote: Scalar.fromBigint(0n),
      storageSchemaVersion: 0
    };
  });

  describe("rawNewAccount", () => {
    it("should create new account state with initial deposit", async () => {
      const amount = 100n;
      const result = await action.rawNewAccount(state, amount);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.balance).toBe(amount);
        expect(result.nonce).toBe(1n);
        // Nullifier and trapdoor should be secret manager's output
        const { nullifier, trapdoor } =
          await cryptoClient.secretManager.getSecrets(
            state.id,
            Number(state.nonce)
          );
        // Note should be hash of [version, id, nullifier, trapdoor, amount]
        const expectedNote = await hashedNote(
          state.id,
          nullifier,
          trapdoor,
          Scalar.fromBigint(amount)
        );
        expect(scalarsEqual(result.currentNote, expectedNote)).toBe(true);
      }
    });
  });

  describe("preparePubInputs", () => {
    it("should prepare public inputs correctly", async () => {
      const amount = 100n;
      const pubInputs = await action.preparePubInputs(state, amount);

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

      const { nullifier, trapdoor } =
        await cryptoClient.secretManager.getSecrets(
          state.id,
          Number(state.nonce)
        );
      expect(
        scalarsEqual(
          pubInputs.hNote,
          await hashedNote(
            state.id,
            nullifier,
            trapdoor,
            Scalar.fromBigint(amount)
          )
        )
      ).toBe(true);
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

      expect(calldata.amount).toBe(amount);
      expect(calldata.expectedContractVersion).toBe(expectedVersion);

      // Verify the proof
      const isValid = await cryptoClient.newAccountCircuit.verify(
        calldata.calldata.proof,
        calldata.calldata.pubInputs
      );
      expect(isValid).toBe(true);
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

      const mockSendTransaction = jest
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
  });
});
