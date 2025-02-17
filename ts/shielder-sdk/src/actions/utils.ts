import {
  CryptoClient,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountState } from "@/state";
import { noteVersion } from "@/utils";

export abstract class NoteAction {
  protected cryptoClient: CryptoClient;
  constructor(cryptoClient: CryptoClient) {
    this.cryptoClient = cryptoClient;
  }
  async rawAction(
    stateOld: AccountState,
    amount: bigint,
    balanceChange: (currentBalance: bigint, amount: bigint) => bigint
  ): Promise<AccountState | null> {
    const { nullifier: nullifierNew, trapdoor: trapdoorNew } =
      await this.cryptoClient.secretManager.getSecrets(
        stateOld.id,
        Number(stateOld.nonce)
      );
    const balanceNew = balanceChange(stateOld.balance, amount);
    if (balanceNew < 0n) {
      return null;
    }
    const scalarArray: Scalar[] = new Array<Scalar>(
      await this.cryptoClient.hasher.poseidonRate()
    ).fill(Scalar.fromBigint(0n));
    scalarArray[0] = Scalar.fromBigint(balanceNew);
    const hAccountBalanceNew =
      await this.cryptoClient.hasher.poseidonHash(scalarArray);
    const version = noteVersion();
    const noteNew = await this.cryptoClient.hasher.poseidonHash([
      version,
      stateOld.id,
      nullifierNew,
      trapdoorNew,
      hAccountBalanceNew
    ]);
    return {
      id: stateOld.id,
      nonce: stateOld.nonce + 1n,
      macSalt: stateOld.macSalt,
      balance: balanceNew,
      currentNote: noteNew,
      storageSchemaVersion: stateOld.storageSchemaVersion
    };
  }

  async merklePathAndRoot(
    rawPath: readonly bigint[]
  ): Promise<[Uint8Array, Scalar]> {
    if (
      rawPath.length !=
      (await this.cryptoClient.noteTreeConfig.treeHeight()) *
        (await this.cryptoClient.noteTreeConfig.arity()) +
        1
    ) {
      throw new Error("Wrong path length");
    }
    const mappedPath = rawPath.map((x) => Scalar.fromBigint(x));
    const path = new Uint8Array(
      mappedPath
        .slice(0, -1) // exclude the root
        .map((x) => x.bytes) // convert to bytes
        .reduce(
          (acc, val) => new Uint8Array([...acc, ...val]),
          new Uint8Array()
        ) // flatten
    );
    const root = mappedPath[mappedPath.length - 1];
    return [path, root];
  }
}

export interface INonceGenerator {
  randomIdHidingNonce(): Scalar;
}
