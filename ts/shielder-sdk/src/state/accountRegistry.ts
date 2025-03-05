import type { Token } from "@/types";
import { AccountStateSerde } from "./accountStateSerde";
import { AccountFactory } from "./accountFactory";
import { StorageManager } from "../storage/storageManager";
import { AccountStateMerkleIndexed } from "./types";
import { getAddressByToken, getTokenByAddress } from "@/utils";

export class AccountRegistry {
  constructor(
    private storageManager: StorageManager,
    private accountFactory: AccountFactory,
    private accountStateSerde: AccountStateSerde
  ) {}

  /**
   * Gets the account state for a token
   */
  async getAccountState(token: Token): Promise<AccountStateMerkleIndexed> {
    const tokenAddress = getAddressByToken(token);
    const indexedAccount =
      await this.storageManager.findAccountByTokenAddress(tokenAddress);

    if (indexedAccount !== null) {
      // Get existing account
      const { accountIndex, accountObject } = indexedAccount;

      return this.accountStateSerde.toAccountState(
        accountObject,
        accountIndex,
        token
      );
    }

    // Create new empty account state
    const nextIndex = await this.storageManager.getNextAccountIndex();
    return this.accountFactory.createEmptyAccountState(token, nextIndex);
  }

  /**
   * Updates the account state for a token
   */
  async updateAccountState(
    token: Token,
    accountState: AccountStateMerkleIndexed
  ): Promise<void> {
    const tokenAddress = getAddressByToken(token);
    const indexedAccount =
      await this.storageManager.findAccountByTokenAddress(tokenAddress);

    if (indexedAccount !== null) {
      // Existing account
      const { accountIndex } = indexedAccount;
      const accountObject = await this.accountStateSerde.toAccountObject(
        accountState,
        accountIndex
      );

      // Save
      await this.storageManager.saveRawAccount(accountIndex, accountObject);
    } else {
      // New account
      const accountIndex = await this.storageManager.getNextAccountIndex();

      const accountObject = await this.accountStateSerde.toAccountObject(
        accountState,
        accountIndex
      );

      // Save and increment index
      await this.storageManager.saveRawAccountAndIncrementNextAccountIndex(
        accountIndex,
        accountObject
      );
    }
  }

  async getAccountIndex(token: Token): Promise<number | null> {
    const tokenAddress = getAddressByToken(token);
    const indexedAccount =
      await this.storageManager.findAccountByTokenAddress(tokenAddress);

    if (indexedAccount !== null) {
      return indexedAccount.accountIndex;
    }

    return null;
  }

  async getTokenByAccountIndex(accountIndex: number): Promise<Token | null> {
    const accountObject = await this.storageManager.getRawAccount(accountIndex);

    if (accountObject !== null) {
      return getTokenByAddress(accountObject.tokenAddress as `0x${string}`);
    }

    return null;
  }
}
