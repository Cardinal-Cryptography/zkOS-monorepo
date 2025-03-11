import { storageSchemaVersion } from "@/constants";
import { z } from "zod";

const validateBigInt = z
  .union([z.string(), z.bigint()])
  .transform((value, ctx) => {
    try {
      return BigInt(value);
    } catch {
      ctx.addIssue({
        message: "Invalid bigint.",
        code: z.ZodIssueCode.custom,
        fatal: true
      });
      return z.NEVER;
    }
  });

// Schema for individual account data
const accountObjectSchema = z.object({
  nonce: validateBigInt,
  balance: validateBigInt,
  idHash: validateBigInt,
  currentNote: validateBigInt,
  currentNoteIndex: validateBigInt,
  tokenAddress: z.string()
});

export type AccountObject = z.infer<typeof accountObjectSchema>;

// Schema for the entire storage object
const storageObjectSchema = z.object({
  // Account data - mapping from account index to account object
  accounts: z.map(z.string(), accountObjectSchema),
  // Index of the next account to be created
  nextAccountIndex: z.number(),
  // Schema version
  storageSchemaVersion: z.number()
});

export type StorageObject = z.infer<typeof storageObjectSchema>;

// Storage key for the entire storage object
const STORAGE_KEY = "__shielder_storage__";

interface InjectedStorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

interface StorageInterface {
  getStorage: () => Promise<z.infer<typeof storageObjectSchema>>;
  setStorage: (value: z.infer<typeof storageObjectSchema>) => Promise<void>;
}

const createStorage = (
  injectedStorage: InjectedStorageInterface
): StorageInterface => {
  // Helper function to get the entire storage object
  const getStorageObject = async (): Promise<z.infer<
    typeof storageObjectSchema
  > | null> => {
    const storedValue = await injectedStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return null;
    }
    try {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
      const parsedValue = JSON.parse(storedValue);
      // iterate over each entry in the accounts map and parse the account object
      const accountsMap = new Map<string, AccountObject>();
      const mapEntries = JSON.parse(parsedValue.accounts);
      for (const [key, value] of mapEntries) {
        accountsMap.set(key, accountObjectSchema.parse(value));
      }

      return storageObjectSchema.parse({
        ...parsedValue,
        accounts: accountsMap
      });

      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
    } catch (error) {
      throw new Error(
        `Failed to parse storage value: ${(error as Error).message}`
      );
    }
  };

  // Helper function to set the entire storage object
  const setStorageObject = async (
    value: z.infer<typeof storageObjectSchema>
  ): Promise<void> => {
    if (value.storageSchemaVersion !== storageSchemaVersion) {
      throw new Error(
        `Storage schema version mismatch: ${value.storageSchemaVersion} != ${storageSchemaVersion}`
      );
    }
    const stringValue = JSON.stringify(value, (_, value): string => {
      if (value instanceof Map) {
        return JSON.stringify(
          Array.from(value.entries()),
          (_, value): string =>
            typeof value === "bigint" ? value.toString() : value
        );
      }
      return value;
    });
    await injectedStorage.setItem(STORAGE_KEY, stringValue);
  };

  // Initialize storage with default values if it doesn't exist
  const ensureInitialized = async (): Promise<
    z.infer<typeof storageObjectSchema>
  > => {
    const storage = await getStorageObject();
    if (storage) {
      return storage;
    }

    // Create a new storage object with default values
    const newStorage: z.infer<typeof storageObjectSchema> = {
      accounts: new Map(),
      nextAccountIndex: 0,
      storageSchemaVersion
    };

    await setStorageObject(newStorage);
    return newStorage;
  };

  return {
    // Get the registry data
    getStorage: async () => {
      const storage = await ensureInitialized();
      return storage;
    },

    // Set the registry data
    setStorage: async (storage) => {
      await setStorageObject(storage);
    }
  };
};

export {
  StorageInterface,
  InjectedStorageInterface,
  createStorage,
  accountObjectSchema,
  storageObjectSchema,
  STORAGE_KEY
};
