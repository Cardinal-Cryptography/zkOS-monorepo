import { it, expect, describe, beforeEach, vi } from "vitest";
import { AccountStateSerde } from "../../src/state/accountStateSerde";
import { IdManager } from "../../src/state/idManager";
import { MockedCryptoClient } from "../helpers";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountObject } from "../../src/storage/storageSchema";
import { nativeToken, erc20Token } from "../../src/utils";
import { AccountStateMerkleIndexed } from "../../src/state/types";

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";

describe("AccountStateSerde", () => {
  let accountStateSerde: AccountStateSerde;
  let idManager: IdManager;
  let cryptoClient: MockedCryptoClient;
  const testPrivateKey =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const testChainId = 1n;
  const testAccountIndex = 0;
  const testErc20Address = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    idManager = new IdManager(testPrivateKey, testChainId, cryptoClient);
    accountStateSerde = new AccountStateSerde(idManager);
  });

  describe("toAccountState", () => {
    [
      {
        name: "native token",
        tokenAddress: nativeTokenAddress,
        token: nativeToken()
      },
      {
        name: "ERC20 token",
        tokenAddress: testErc20Address,
        token: erc20Token(testErc20Address)
      }
    ].forEach(({ name, tokenAddress, token }) => {
      it(`should convert AccountObject to AccountState for ${name}`, async () => {
        const id = await idManager.getId(testAccountIndex);
        const idHash = await idManager.getIdHash(testAccountIndex);

        const accountObject: AccountObject = {
          idHash: scalarToBigint(idHash),
          nonce: 1n,
          balance: 100n,
          currentNote: 123n,
          currentNoteIndex: 2n,
          tokenAddress
        };

        const accountState = await accountStateSerde.toAccountState(
          accountObject,
          testAccountIndex,
          token
        );

        expect(scalarsEqual(accountState.id, id)).toBe(true);
        expect(accountState.token).toEqual(token);
        expect(accountState.nonce).toBe(1n);
        expect(accountState.balance).toBe(100n);
        expect(accountState.currentNoteIndex).toBe(2n);
        expect(
          scalarsEqual(accountState.currentNote, Scalar.fromBigint(123n))
        ).toBe(true);
      });
    });

    it("should throw when ID hash does not match", async () => {
      const accountObject: AccountObject = {
        idHash: 999999n, // Invalid ID hash
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      await expect(
        accountStateSerde.toAccountState(
          accountObject,
          testAccountIndex,
          nativeToken()
        )
      ).rejects.toThrow("ID hash does not match the expected value");
    });
  });

  describe("toAccountObject", () => {
    [
      {
        name: "native token",
        tokenAddress: nativeTokenAddress,
        token: nativeToken()
      },
      {
        name: "ERC20 token",
        tokenAddress: testErc20Address,
        token: erc20Token(testErc20Address)
      }
    ].forEach(({ name, tokenAddress, token }) => {
      it(`should convert AccountState to AccountObject for ${name}`, async () => {
        const id = await idManager.getId(testAccountIndex);
        const idHash = await idManager.getIdHash(testAccountIndex);

        const accountState: AccountStateMerkleIndexed = {
          id,
          token,
          nonce: 1n,
          balance: 100n,
          currentNote: Scalar.fromBigint(123n),
          currentNoteIndex: 2n
        };

        const accountObject = await accountStateSerde.toAccountObject(
          accountState,
          testAccountIndex
        );

        expect(accountObject.idHash).toBe(scalarToBigint(idHash));
        expect(accountObject.nonce).toBe(1n);
        expect(accountObject.balance).toBe(100n);
        expect(accountObject.currentNote).toBe(123n);
        expect(accountObject.currentNoteIndex).toBe(2n);
        expect(accountObject.tokenAddress).toBe(tokenAddress);
      });
    });
  });
});
