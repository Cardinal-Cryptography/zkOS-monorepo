import { AccountObject, StorageInterface } from "./storageSchema";

/**
 * Manages low-level storage operations
 */
export class StorageManager {
  constructor(private storage: StorageInterface) {}

  /**
   * Gets the raw account object for an index
   */
  async getRawAccount(index: number): Promise<AccountObject | null> {
    const storageData = await this.storage.getStorage();
    return storageData.accounts.get(index.toString()) || null;
  }

  /**
   * Saves a raw account object at an index
   */
  async saveRawAccount(index: number, account: AccountObject): Promise<void> {
    const storageData = await this.storage.getStorage();
    storageData.accounts.set(index.toString(), { ...account });
    await this.storage.setStorage(storageData);
  }

  /**
   * Gets the next available account index
   */
  async getNextAccountIndex(): Promise<number> {
    const storageData = await this.storage.getStorage();
    return storageData.nextAccountIndex;
  }

  /**
   * Increments the next account index
   */
  async saveRawAccountAndIncrementNextAccountIndex(
    index: number,
    account: AccountObject
  ): Promise<void> {
    const storageData = await this.storage.getStorage();
    storageData.accounts.set(index.toString(), { ...account });
    storageData.nextAccountIndex += 1;
    await this.storage.setStorage(storageData);
  }

  /**
   * Finds an account index by token address
   */
  async findAccountByTokenAddress(tokenAddress: string): Promise<{
    accountIndex: number;
    accountObject: AccountObject;
  } | null> {
    const storageData = await this.storage.getStorage();

    for (const [index, account] of storageData.accounts.entries()) {
      if (account.tokenAddress === tokenAddress) {
        return {
          accountIndex: parseInt(index),
          accountObject: { ...account }
        };
      }
    }

    return null;
  }

  /**
   * Gets all accounts
   */
  async getAllAccounts(): Promise<
    { accountIndex: number; accountObject: AccountObject }[]
  > {
    const storageData = await this.storage.getStorage();
    return Array.from(storageData.accounts.entries()).map(
      ([index, account]) => ({
        accountIndex: parseInt(index),
        accountObject: { ...account }
      })
    );
  }
}
