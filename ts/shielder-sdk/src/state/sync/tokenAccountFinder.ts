import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Token } from "@/types";
import { IdManager } from "../idManager";
import { getTokenByAddress } from "@/utils";

export class TokenAccountFinder {
  constructor(
    private contract: IContract,
    private cryptoClient: CryptoClient,
    private idManager: IdManager
  ) {}

  async findTokenByAccountIndex(accountIndex: number): Promise<Token | null> {
    const preNullifier = await this.cryptoClient.hasher.poseidonHash([
      await this.idManager.getId(accountIndex)
    ]);

    const block = await this.contract.nullifierBlock(
      scalarToBigint(preNullifier)
    );
    if (!block) {
      // Account does not exist
      return null;
    }
    const unfilteredEvents =
      await this.contract.getNewAccountEventsFromBlock(block);
    const bigintPreNullifier = scalarToBigint(preNullifier);

    const events = unfilteredEvents.filter((event) => {
      return event.prenullifier === bigintPreNullifier;
    });

    if (events.length != 1) {
      throw new Error(
        `Unexpected number of events: ${events.length}, expected 1 event`
      );
    }

    const tokenAddress = events[0].tokenAddress;

    return getTokenByAddress(tokenAddress);
  }
}
