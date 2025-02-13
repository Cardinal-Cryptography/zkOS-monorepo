import { it, expect, vitest, describe, beforeEach, Mocked } from "vitest";
import accountObjectSchema, {
  createStorage,
  type InjectedStorageInterface
} from "../../src/state/storageSchema";
import { nativeTokenAddress } from "../../src/constants";

describe("validateBigInt", () => {
  it("should parse valid bigint strings", () => {
    const result = accountObjectSchema.shape.nonce.parse("123");
    expect(result).toBe(123n);
  });

  it("should parse large bigint strings", () => {
    const largeNumber = "9007199254740991"; // Number.MAX_SAFE_INTEGER
    const result = accountObjectSchema.shape.nonce.parse(largeNumber);
    expect(result).toBe(9007199254740991n);
  });

  it("should throw error for invalid bigint strings", () => {
    expect(() =>
      accountObjectSchema.shape.nonce.parse("not a number")
    ).toThrow();
  });
});

describe("storageSchema", () => {
  it("should validate complete state object", () => {
    const validState = {
      nonce: "1",
      balance: "1000",
      idHash: "12345",
      currentNote: "67890",
      currentNoteIndex: "2",
      storageSchemaVersion: 2
    };

    const result = accountObjectSchema.parse(validState);
    expect(result).toEqual({
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      storageSchemaVersion: 2
    });
  });

  it("should validate state without optional currentNoteIndex", () => {
    const validState = {
      nonce: "1",
      balance: "1000",
      idHash: "12345",
      currentNote: "67890",
      storageSchemaVersion: 2
    };

    const result = accountObjectSchema.parse(validState);
    expect(result).toEqual({
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      storageSchemaVersion: 2
    });
  });

  it.each([
    {
      invalidState: {
        nonce: "1",
        balance: "not a number", // non-bigint string here
        idHash: "12345",
        currentNote: "67890",
        storageSchemaVersion: 2
      },
      propertyKey: "balance"
    },
    {
      invalidState: {
        nonce: "1",
        balance: "1000",
        idHash: "12345",
        currentNote: "67890",
        storageSchemaVersion: "2" // string here
      },
      propertyKey: "storageSchemaVersion"
    },
    {
      invalidState: {
        // missing nonce here
        balance: "1000",
        idHash: "12345",
        currentNote: "67890",
        storageSchemaVersion: 2
      },
      propertyKey: "nonce"
    }
  ])(
    "should throw error for state object with wrong types for $propertyKey",
    ({ invalidState, propertyKey }) => {
      expect(() => accountObjectSchema.parse(invalidState)).toThrow(
        `${propertyKey}`
      );
    }
  );
});

describe("createStorage", () => {
  let mockInjectedStorage: Mocked<InjectedStorageInterface>;

  beforeEach(() => {
    mockInjectedStorage = {
      getItem: vitest.fn(),
      setItem: vitest.fn()
    };
  });

  it("getItem should return null for non-existent key", async () => {
    mockInjectedStorage.getItem.mockResolvedValue(null);
    const storage = createStorage(mockInjectedStorage);

    const result = await storage.getItem(nativeTokenAddress);
    expect(result).toBeNull();
  });

  it("getItem should parse and return valid stored value", async () => {
    const validState = {
      nonce: "1",
      balance: "1000",
      idHash: "12345",
      currentNote: "67890",
      storageSchemaVersion: 2
    };
    mockInjectedStorage.getItem.mockResolvedValue(JSON.stringify(validState));
    const storage = createStorage(mockInjectedStorage);

    const result = await storage.getItem(nativeTokenAddress);
    expect(result).toEqual({
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      storageSchemaVersion: 2
    });
  });

  it("getItem should throw error for invalid stored value", async () => {
    const invalidState = {
      nonce: "not a number",
      balance: "1000",
      idHash: "12345",
      currentNote: "67890",
      storageSchemaVersion: 2
    };
    mockInjectedStorage.getItem.mockResolvedValue(JSON.stringify(invalidState));
    const storage = createStorage(mockInjectedStorage);

    await expect(storage.getItem(nativeTokenAddress)).rejects.toThrow(
      `Failed to parse storage value for key ${nativeTokenAddress}:`
    );
  });

  it("setItem should store stringified value with bigints converted", async () => {
    const storage = createStorage(mockInjectedStorage);
    const state = {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      storageSchemaVersion: 2
    };

    await storage.setItem(nativeTokenAddress, state);

    expect(mockInjectedStorage.setItem).toHaveBeenCalledWith(
      nativeTokenAddress,
      JSON.stringify({
        nonce: "1",
        balance: "1000",
        idHash: "12345",
        currentNote: "67890",
        storageSchemaVersion: 2
      })
    );
  });
});
