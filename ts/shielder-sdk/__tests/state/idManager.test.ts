import { it, expect, describe, beforeEach, vi } from "vitest";
import { IdManager } from "../../src/state/idManager";
import { MockedCryptoClient } from "../helpers";
import {
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";

describe("IdManager", () => {
  let idManager: IdManager;
  let cryptoClient: MockedCryptoClient;
  const testPrivateKey =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const testChainId = 1n;
  const testToken1Index = 0;
  const testToken2Index = 1;

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    idManager = new IdManager(testPrivateKey, testChainId, cryptoClient);
  });

  describe("getId", () => {
    it("should derive an ID for a token address", async () => {
      const id = await idManager.getId(testToken1Index);

      const expectedId = await cryptoClient.secretManager.deriveId(
        testPrivateKey,
        testChainId,
        testToken1Index
      );
      expect(scalarsEqual(id, expectedId)).toBe(true);
    });

    it("should cache the ID for subsequent calls", async () => {
      const deriveSpy = vi.spyOn(cryptoClient.secretManager, "deriveId");

      // First call should derive the ID
      const id1 = await idManager.getId(testToken1Index);
      expect(deriveSpy).toHaveBeenCalledTimes(1);

      // Second call should use the cached value
      const id2 = await idManager.getId(testToken1Index);
      expect(deriveSpy).toHaveBeenCalledTimes(1); // Still only called once

      expect(scalarsEqual(id1, id2)).toBe(true);
    });

    it("should derive different IDs for different token addresses", async () => {
      const id1 = await idManager.getId(testToken1Index);
      const id2 = await idManager.getId(testToken2Index);
      console.log(id1.bytes.toString());
      console.log(id2.bytes.toString());

      // IDs should be different
      expect(scalarsEqual(id1, id2)).toBe(false);
    });
  });

  describe("getIdHash", () => {
    it("should derive an ID hash for a token address", async () => {
      const idHash = await idManager.getIdHash(testToken1Index);

      // Verify that the ID hash was derived correctly
      const id = await idManager.getId(testToken1Index);
      const expectedIdHash = await cryptoClient.hasher.poseidonHash([id]);
      expect(scalarsEqual(idHash, expectedIdHash)).toBe(true);
    });

    it("should cache the ID hash for subsequent calls", async () => {
      const hashSpy = vi.spyOn(cryptoClient.hasher, "poseidonHash");

      // First call should derive the ID hash
      const idHash1 = await idManager.getIdHash(testToken1Index);
      expect(hashSpy).toHaveBeenCalledTimes(1);

      // Second call should use the cached value
      const idHash2 = await idManager.getIdHash(testToken1Index);
      expect(hashSpy).toHaveBeenCalledTimes(1); // Still only called once

      // Both ID hashes should be the same
      expect(scalarsEqual(idHash1, idHash2)).toBe(true);
    });

    it("should use cached ID when available", async () => {
      // Spy on the getId method
      const getIdSpy = vi.spyOn(idManager, "getId");

      // Call getId first to cache the ID
      await idManager.getId(testToken1Index);

      // Reset the spy count
      getIdSpy.mockClear();

      // Call getIdHash
      await idManager.getIdHash(testToken1Index);

      // getId should still be called, but it should use the cached value
      expect(getIdSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("validateIdHash", () => {
    it("should not throw when the ID hash is valid", async () => {
      const idHash = await idManager.getIdHash(testToken1Index);
      const storedIdHash = scalarToBigint(idHash);

      // Should not throw
      await expect(
        idManager.validateIdHash(testToken1Index, storedIdHash)
      ).resolves.not.toThrow();
    });

    it("should throw when the ID hash is invalid", async () => {
      const invalidIdHash = 999999n; // Different from the actual ID hash

      // Should throw
      await expect(
        idManager.validateIdHash(testToken1Index, invalidIdHash)
      ).rejects.toThrow("ID hash does not match the expected value");
    });
  });
});
