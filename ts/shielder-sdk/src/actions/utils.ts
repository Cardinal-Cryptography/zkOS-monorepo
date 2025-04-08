import {
  CryptoClient,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { getAddressByToken, noteVersion } from "@/utils";
import { bytesToHex } from "viem";
import { AccountState } from "@/state/types";

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
    const tokenAddress = getAddressByToken(stateOld.token);
    const { nullifier: nullifierNew } =
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
    scalarArray[1] = Scalar.fromAddress(tokenAddress);
    const hAccountBalanceNew =
      await this.cryptoClient.hasher.poseidonHash(scalarArray);
    const version = noteVersion();
    const noteNew = await this.cryptoClient.hasher.poseidonHash([
      version,
      stateOld.id,
      nullifierNew,
      hAccountBalanceNew
    ]);
    return {
      id: stateOld.id,
      nonce: stateOld.nonce + 1n,
      balance: balanceNew,
      currentNote: noteNew,
      token: stateOld.token
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

  async randomSalt(): Promise<Scalar> {
    const random32Bytes = crypto.getRandomValues(new Uint8Array(32));
    const random32BytesHex = bytesToHex(random32Bytes);
    return await this.cryptoClient.converter.hex32ToScalar(random32BytesHex);
  }
}
