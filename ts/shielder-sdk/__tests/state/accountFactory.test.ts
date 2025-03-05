import { it, expect, describe, beforeEach, vi } from "vitest";
import { AccountFactory } from "../../src/state/accountFactory";
import { IdManager } from "../../src/state/idManager";
import { MockedCryptoClient } from "../helpers";
import {
  Scalar,
  scalarsEqual
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeToken, erc20Token } from "../../src/utils";
import { nativeTokenAddress } from "../../src/constants";

describe("AccountFactory", () => {
  let accountFactory: AccountFactory;
  let idManager: IdManager;
  let cryptoClient: MockedCryptoClient;
  const testPrivateKey =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const testChainId = 1n;
  const testErc20Address = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    idManager = new IdManager(testPrivateKey, testChainId, cryptoClient);
    accountFactory = new AccountFactory(idManager);
  });

  describe("createEmptyAccountState", () => {
    it("should create an empty account state for native token", async () => {
      const token = nativeToken();
      const accountIndex = 0;
      const state = await accountFactory.createEmptyAccountState(
        token,
        accountIndex
      );

      // Verify the token
      expect(state.token).toEqual(token);

      // Verify the ID
      const expectedId = await idManager.getId(accountIndex);
      expect(scalarsEqual(state.id, expectedId)).toBe(true);

      // Verify other properties
      expect(state.nonce).toBe(0n);
      expect(state.balance).toBe(0n);
      expect(scalarsEqual(state.currentNote, Scalar.fromBigint(0n))).toBe(true);
    });

    it("should create an empty account state for ERC20 token", async () => {
      const token = erc20Token(testErc20Address);
      const accountIndex = 0;
      const state = await accountFactory.createEmptyAccountState(
        token,
        accountIndex
      );

      // Verify the token
      expect(state.token).toEqual(token);

      // Verify the ID
      const expectedId = await idManager.getId(accountIndex);
      expect(scalarsEqual(state.id, expectedId)).toBe(true);

      // Verify other properties
      expect(state.nonce).toBe(0n);
      expect(state.balance).toBe(0n);
      expect(scalarsEqual(state.currentNote, Scalar.fromBigint(0n))).toBe(true);
    });

    it("should use the ID manager to get the ID", async () => {
      // Spy on the getId method
      const getIdSpy = vi.spyOn(idManager, "getId");

      // Create an empty account state
      const token = nativeToken();
      const accountIndex = 0;
      await accountFactory.createEmptyAccountState(token, accountIndex);

      // Verify that getId was called with the correct account index
      expect(getIdSpy).toHaveBeenCalledWith(accountIndex);
    });
  });
});
