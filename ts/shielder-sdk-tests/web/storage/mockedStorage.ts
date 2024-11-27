import { type InjectedStorageInterface } from "shielder-sdk/__internal__";

export const mockedStorage = (
  address: `0x${string}`,
): InjectedStorageInterface => {
  const setItem = async (key: string, value: string): Promise<void> => {
    try {
      // prevent storage from being shared between different addresses in different tests
      window.localStorage.setItem(key + address, value);
    } catch (error) {
      console.error(`Failed to save storage value for key ${key}:`, error);
    }
  };

  const getItem = async (key: string): Promise<string | null> => {
    const storedValue: string | null = window.localStorage.getItem(
      // prevent storage from being shared between different addresses in different tests
      key + address,
    );

    if (!storedValue) {
      return null;
    }
    return storedValue;
  };

  return { getItem, setItem };
};
