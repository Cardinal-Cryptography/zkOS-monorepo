import { z } from "zod";

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

const accountObjectSchema = z.object({
  nonce: validateBigInt,
  balance: validateBigInt,
  idHash: validateBigInt,
  currentNote: validateBigInt,
  currentNoteIndex: validateBigInt,
  storageSchemaVersion: z.number()
});

interface InjectedStorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

interface StorageInterface {
  getItem: (key: string) => Promise<z.infer<typeof accountObjectSchema> | null>;
  setItem: (
    key: string,
    value: z.infer<typeof accountObjectSchema>
  ) => Promise<void>;
}

const createStorage = (
  injectedStorage: InjectedStorageInterface
): StorageInterface => {
  const getItem = async (
    key: string
  ): Promise<z.infer<typeof accountObjectSchema> | null> => {
    const storedValue = await injectedStorage.getItem(key);
    if (!storedValue) {
      return null;
    }
    try {
      return accountObjectSchema.parse(JSON.parse(storedValue));
    } catch (error) {
      throw new Error(
        `Failed to parse storage value for key ${key}: ${(error as Error).message}`
      );
    }
  };
  const setItem = async (
    key: string,
    value: z.infer<typeof accountObjectSchema>
  ): Promise<void> => {
    const stringValue = JSON.stringify(value, (_, value): string =>
      typeof value === "bigint" ? value.toString() : value
    );
    await injectedStorage.setItem(key, stringValue);
  };
  return { getItem, setItem };
};

export {
  accountObjectSchema,
  StorageInterface,
  InjectedStorageInterface,
  createStorage
};
