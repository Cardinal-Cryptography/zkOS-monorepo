import { it, expect, vitest, describe, beforeEach, Mocked } from "vitest";
import {
  accountObjectSchema,
  storageObjectSchema,
  createStorage,
  type InjectedStorageInterface,
  STORAGE_KEY
} from "../../src/storage/storageSchema";

const storageSchemaVersion = 2;

const mockedTokenAddress = "0x7e50210642A8C6ecf8fd13Ce2E20A4F52C6C4d9a";

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

  it("should accept and return bigint values directly", () => {
    const value = 123n;
    const result = accountObjectSchema.shape.nonce.parse(value);
    expect(result).toBe(123n);
  });

  it("should throw error for invalid bigint strings", () => {
    expect(() =>
      accountObjectSchema.shape.nonce.parse("not a number")
    ).toThrow();
  });
});

describe("accountObjectSchema", () => {
  it("should validate complete account object", () => {
    const validAccount = {
      nonce: "1",
      balance: "1000",
      idHash: "12345",
      currentNote: "67890",
      currentNoteIndex: "2",
      tokenAddress: mockedTokenAddress
    };

    const result = accountObjectSchema.parse(validAccount);
    expect(result).toEqual({
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });
  });

  it.each([
    {
      invalidAccount: {
        nonce: "1",
        balance: "not a number", // non-bigint string here
        idHash: "12345",
        currentNote: "67890",
        currentNoteIndex: "2",
        tokenAddress: mockedTokenAddress
      },
      errorContains: "balance"
    },
    {
      invalidAccount: {
        nonce: "1",
        balance: "1000",
        idHash: "12345",
        currentNote: "67890",
        currentNoteIndex: "2"
        // missing tokenAddress
      },
      errorContains: "tokenAddress"
    },
    {
      invalidAccount: {
        // missing nonce
        balance: "1000",
        idHash: "12345",
        currentNote: "67890",
        currentNoteIndex: "2",
        tokenAddress: mockedTokenAddress
      },
      errorContains: "nonce"
    }
  ])(
    "should throw error for account object with issues in $errorContains",
    ({ invalidAccount, errorContains }) => {
      expect(() => accountObjectSchema.parse(invalidAccount)).toThrow();
      try {
        accountObjectSchema.parse(invalidAccount);
      } catch (error) {
        expect(JSON.stringify(error)).toContain(errorContains);
      }
    }
  );
});

describe("storageObjectSchema", () => {
  it("should validate complete storage object", () => {
    const accountsMap = new Map();
    accountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    const validStorage = {
      accounts: accountsMap,
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion
    };

    const result = storageObjectSchema.parse(validStorage);
    expect(result).toEqual(validStorage);
  });

  it("should throw error for storage object with invalid schema version", () => {
    const accountsMap = new Map();
    accountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    const invalidStorage = {
      accounts: accountsMap,
      nextAccountIndex: 1,
      storageSchemaVersion: "invalid" // should be a number
    };

    expect(() => storageObjectSchema.parse(invalidStorage)).toThrow();
    try {
      storageObjectSchema.parse(invalidStorage);
    } catch (error) {
      expect(JSON.stringify(error)).toContain("storageSchemaVersion");
    }
  });

  it("should throw error for storage object with invalid nextAccountIndex", () => {
    const accountsMap = new Map();
    accountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    const invalidStorage = {
      accounts: accountsMap,
      nextAccountIndex: "1", // should be a number
      storageSchemaVersion: storageSchemaVersion
    };

    expect(() => storageObjectSchema.parse(invalidStorage)).toThrow();
    try {
      storageObjectSchema.parse(invalidStorage);
    } catch (error) {
      expect(JSON.stringify(error)).toContain("nextAccountIndex");
    }
  });
});

describe("createStorage", () => {
  let mockInjectedStorage: Mocked<InjectedStorageInterface>;

  beforeEach(() => {
    mockInjectedStorage = {
      getItem: vitest.fn(),
      setItem: vitest.fn()
    };
  });

  it("should initialize storage with default values if it doesn't exist", async () => {
    mockInjectedStorage.getItem.mockResolvedValue(null);
    const storage = createStorage(mockInjectedStorage);

    const result = await storage.getStorage();

    expect(result).toEqual({
      accounts: new Map(),
      nextAccountIndex: 0,
      storageSchemaVersion: storageSchemaVersion
    });
  });

  it("should parse and return valid stored storage", async () => {
    // Create a valid storage object with an accounts map
    const accountsMap = new Map();
    accountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    // Mock the stored JSON string
    // Note: Maps are serialized as arrays of entries
    const mockStoredValue = {
      accounts: JSON.stringify([
        [
          "0",
          {
            nonce: "1",
            balance: "1000",
            idHash: "12345",
            currentNote: "67890",
            currentNoteIndex: "2",
            tokenAddress: mockedTokenAddress
          }
        ]
      ]),
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion
    };

    mockInjectedStorage.getItem.mockResolvedValue(
      JSON.stringify(mockStoredValue)
    );
    const storage = createStorage(mockInjectedStorage);

    const result = await storage.getStorage();

    // The expected result should have the accounts as a Map
    const expectedAccountsMap = new Map();
    expectedAccountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    expect(result).toEqual({
      accounts: expectedAccountsMap,
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion
    });
  });

  it("should throw error for invalid stored value", async () => {
    const invalidStoredValue = {
      accounts: JSON.stringify([
        [
          "0",
          {
            nonce: "not a number", // Invalid nonce
            balance: "1000",
            idHash: "12345",
            currentNote: "67890",
            currentNoteIndex: "2",
            tokenAddress: mockedTokenAddress
          }
        ]
      ]),
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion
    };

    mockInjectedStorage.getItem.mockResolvedValue(
      JSON.stringify(invalidStoredValue)
    );
    const storage = createStorage(mockInjectedStorage);

    await expect(storage.getStorage()).rejects.toThrow(
      "Failed to parse storage value"
    );
  });

  it("should store stringified storage with bigints and maps converted", async () => {
    mockInjectedStorage.getItem.mockResolvedValue(null); // Start with empty storage
    const storage = createStorage(mockInjectedStorage);

    // Create a storage object to save
    const accountsMap = new Map();
    accountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    const storageToSave = {
      accounts: accountsMap,
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion
    };

    await storage.setStorage(storageToSave);

    // Check that setItem was called with the correct stringified value
    expect(mockInjectedStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String)
    );

    // Parse the stringified value to check its structure
    const stringifiedValue = mockInjectedStorage.setItem.mock.calls[0][1];
    const parsedValue = JSON.parse(stringifiedValue);

    // Check the structure of the stringified value
    expect(parsedValue).toEqual({
      accounts: expect.any(String), // The accounts map is stringified
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion
    });

    // Parse the accounts string to check its structure
    const parsedAccounts = JSON.parse(parsedValue.accounts);
    expect(parsedAccounts).toEqual([
      [
        "0",
        {
          nonce: "1", // Bigints are converted to strings
          balance: "1000",
          idHash: "12345",
          currentNote: "67890",
          currentNoteIndex: "2",
          tokenAddress: mockedTokenAddress
        }
      ]
    ]);
  });

  it("should throw error when setting storage with wrong schema version", async () => {
    mockInjectedStorage.getItem.mockResolvedValue(null);
    const storage = createStorage(mockInjectedStorage);

    // Create a storage object with wrong schema version
    const accountsMap = new Map();
    accountsMap.set("0", {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    });

    const invalidStorage = {
      accounts: accountsMap,
      nextAccountIndex: 1,
      storageSchemaVersion: storageSchemaVersion + 1 // Wrong version
    };

    await expect(storage.setStorage(invalidStorage)).rejects.toThrow(
      "Storage schema version mismatch"
    );
  });
});
