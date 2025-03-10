import { beforeEach, describe, expect, it, vitest } from "vitest";
import {
  NewAccountAdvice,
  NewAccountPubInputs,
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

import { MockedCryptoClient, hashedNote } from "../helpers";

import { NewAccountAction } from "../../src/actions/newAccount";
import { AccountState } from "../../src/state/types";
import { IContract } from "../../src/chain/contract";
import { SendShielderTransaction } from "../../src/client/types";
import { nativeToken } from "../../src/utils";
import { OutdatedSdkError } from "../../src/errors";

const ANONYMITY_REVOKER_PUBKEY = [123n, 456n];

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
      anonymityRevokerPubkey: vitest
        .fn()
        .mockResolvedValue(ANONYMITY_REVOKER_PUBKEY),
      newAccountNativeCalldata: vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            newNote: bigint,
            idHash: bigint,
            amount: bigint,
            symKeyEncryption1X: bigint,
            symKeyEncryption1Y: bigint,
            symKeyEncryption2X: bigint,
            symKeyEncryption2Y: bigint,
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
      token: nativeToken()
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

  describe("generateCalldata", () => {
    it("should generate valid calldata", async () => {
      const amount = 100n;
      const expectedVersion = "0xversion" as `0x${string}`;
      const calldata = await action.generateCalldata(
        mockedState,
        amount,
        expectedVersion
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
        .fn<(values: NewAccountAdvice<Scalar>) => Promise<Uint8Array>>()
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
            pubInputs: NewAccountPubInputs<Scalar>
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

      expect(contract.newAccountNativeCalldata).toHaveBeenCalledWith(
        expectedVersion,
        mockAddress,
        scalarToBigint(calldata.calldata.pubInputs.hNote),
        scalarToBigint(calldata.calldata.pubInputs.hId),
        amount,
        scalarToBigint(calldata.calldata.pubInputs.symKeyEncryption1X),
        scalarToBigint(calldata.calldata.pubInputs.symKeyEncryption1Y),
        scalarToBigint(calldata.calldata.pubInputs.symKeyEncryption2X),
        scalarToBigint(calldata.calldata.pubInputs.symKeyEncryption2Y),
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

      const mockedErr = new OutdatedSdkError("123");

      contract.newAccountNativeCalldata = vitest
        .fn<
          (
            expectedContractVersion: `0x${string}`,
            from: `0x${string}`,
            newNote: bigint,
            idHash: bigint,
            amount: bigint,
            symKeyEncryption1X: bigint,
            symKeyEncryption1Y: bigint,
            symKeyEncryption2X: bigint,
            symKeyEncryption2Y: bigint,
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
