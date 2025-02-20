import type { InjectedStorageInterface } from "@cardinal-cryptography/shielder-sdk";

export const STORAGE_KEY = "test-mocked-storage";

type SubStorage = {
  [key: string]: string;
};

export const mockedStorage = (
  mainKey: `0x${string}`
): InjectedStorageInterface & {
  clear: () => void;
} => {
  const getSubStorage = (): SubStorage => {
    const stored = window.localStorage.getItem(mainKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return stored ? JSON.parse(stored) : {};
  };

  const saveSubStorage = (storage: SubStorage): void => {
    window.localStorage.setItem(mainKey, JSON.stringify(storage));
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  const setItem = async (key: string, value: string): Promise<void> => {
    try {
      const storage = getSubStorage();
      storage[key] = value;
      saveSubStorage(storage);
    } catch (error) {
      console.error(`Failed to save storage value for key ${key}:`, error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  const getItem = async (key: string): Promise<string | null> => {
    const storage = getSubStorage();
    return storage[key] ?? null;
  };

  const clear = (): void => {
    window.localStorage.removeItem(mainKey);
  };

  return { getItem, setItem, clear };
};
