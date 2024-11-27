import { z } from 'zod';

import storageSchema, { type StorageKeys } from './storageSchema';

const setItem = async <K extends StorageKeys>(key: K, value: z.infer<typeof storageSchema[K]>): Promise<void> => {
  try {
    const stringValue = JSON.stringify(value, (_, value): string =>
      typeof value === 'bigint' ? value.toString() : value
    );

    if (process.env.PLASMO_PUBLIC_STORAGE_MODE == 'webapp') {
      window.localStorage.setItem(key, stringValue);
    } else {
      await chrome.storage.local.set({ [key]: stringValue });
    }
  } catch (error) {
    console.error(`Failed to save storage value for key ${key}:`, error);
  }
};

const getItem = async <K extends StorageKeys>(key: K): Promise<z.infer<typeof storageSchema[K]> | null> => {
  let storedValue: string | null;

  if (process.env.PLASMO_PUBLIC_STORAGE_MODE == 'webapp') {
    storedValue = window.localStorage.getItem(key);
  } else {
    const result = await chrome.storage.local.get([key]);
    storedValue = result[key] as string | undefined ?? null;
  }

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

export { getItem, setItem };
