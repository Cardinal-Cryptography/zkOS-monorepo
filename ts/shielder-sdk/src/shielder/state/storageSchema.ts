import { z } from "zod";

type StateManagerStorageKeys = "accountState";

const validateBigInt = z.string().transform((value, ctx) => {
  try {
    return BigInt(value);
  } catch {
    ctx.addIssue({
      message: "Invalid bigint string.",
      code: z.ZodIssueCode.custom,
      fatal: true
    });
    return z.NEVER;
  }
});

const storageSchema = {
  accountState: z.object({
    nonce: validateBigInt,
    balance: validateBigInt,
    idHash: validateBigInt,
    currentNote: validateBigInt,
    currentNoteIndex: z.union([validateBigInt, z.undefined()]).optional()
  })
} satisfies Record<StateManagerStorageKeys, z.ZodSchema>;

interface InjectedStorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

interface StorageInterface {
  getItem: <K extends StateManagerStorageKeys>(
    key: K
  ) => Promise<z.infer<(typeof storageSchema)[K]> | null>;
  setItem: <K extends StateManagerStorageKeys>(
    key: K,
    value: z.infer<(typeof storageSchema)[K]>
  ) => Promise<void>;
}

const createStorage = (
  injectedStorage: InjectedStorageInterface
): StorageInterface => {
  const getItem = async <K extends StateManagerStorageKeys>(
    key: K
  ): Promise<z.infer<(typeof storageSchema)[K]> | null> => {
    const storedValue = await injectedStorage.getItem(key);
    if (!storedValue) {
      return null;
    }
    try {
      return storageSchema[key].parse(JSON.parse(storedValue));
    } catch (error) {
      console.error(`Failed to parse storage value for key ${key}:`, error);
      return null;
    }
  };
  const setItem = async <K extends StateManagerStorageKeys>(
    key: K,
    value: z.infer<(typeof storageSchema)[K]>
  ): Promise<void> => {
    const stringValue = JSON.stringify(value, (_, value): string =>
      typeof value === "bigint" ? value.toString() : value
    );
    await injectedStorage.setItem(key, stringValue);
  };
  return { getItem, setItem };
};

export default storageSchema;
export {
  type StateManagerStorageKeys,
  StorageInterface,
  InjectedStorageInterface,
  createStorage
};
