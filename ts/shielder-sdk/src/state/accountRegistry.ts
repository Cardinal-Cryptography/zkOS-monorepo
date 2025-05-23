import type { Token } from "@/types";
import { AccountStateSerde } from "./accountStateSerde";
import { AccountFactory } from "./accountFactory";
import { StorageManager } from "../storage/storageManager";
import { AccountState, AccountStateMerkleIndexed } from "./types";
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
  async getAccountState(
    token: Token
  ): Promise<AccountStateMerkleIndexed | null> {
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
    return null;
  }

  async createEmptyAccountState(token: Token): Promise<AccountState> {
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

    const { accountIndex } = indexedAccount ?? {
      accountIndex: await this.storageManager.getNextAccountIndex()
    };

    const accountObject = await this.accountStateSerde.toAccountObject(
      accountState,
      accountIndex
    );
    await this.storageManager.saveRawAccount(accountIndex, accountObject);
  }

  async getTokenByAccountIndex(accountIndex: number): Promise<Token | null> {
    const accountObject = await this.storageManager.getRawAccount(accountIndex);

    if (accountObject !== null) {
      return getTokenByAddress(accountObject.tokenAddress as `0x${string}`);
    }

    return null;
  }

  async getAccountStatesList(): Promise<AccountStateMerkleIndexed[]> {
    const accounts = await this.storageManager.getAllAccounts();

    return Promise.all(
      accounts.map(({ accountIndex, accountObject }) =>
        this.accountStateSerde.toAccountState(
          accountObject,
          accountIndex,
          getTokenByAddress(accountObject.tokenAddress as `0x${string}`)
        )
      )
    );
  }
}
