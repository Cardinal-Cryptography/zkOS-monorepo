import {
  CryptoClient,
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { StorageInterface } from "./storageSchema";
import { Hex } from "viem";
import { AccountState } from "./types";
import { storageSchemaVersion } from "@/constants";

export class StateManager {
  private storage: StorageInterface;
  private privateKey: Hex;
  private id: Scalar | undefined;
  private idHash: Scalar | undefined;
  private cryptoClient: CryptoClient;

  constructor(
    privateKey: Hex,
    storage: StorageInterface,
    cryptoClient: CryptoClient
  ) {
    this.privateKey = privateKey;
    this.storage = storage;
    this.cryptoClient = cryptoClient;
  }

  async accountState(): Promise<AccountState> {
    const res = await this.storage.getItem("accountState");
    const id = await this.getId();
    if (res) {
      const expectedIdHash = await this.getIdHash();
      const storageIdHash = Scalar.fromBigint(res.idHash);
      if (!scalarsEqual(expectedIdHash, storageIdHash)) {
        throw new Error("Id hash in storage does not matched the configured.");
      }
      const obj = res;
      return {
        id,
        nonce: BigInt(obj.nonce),
        balance: BigInt(obj.balance),
        currentNote: Scalar.fromBigint(BigInt(obj.currentNote)),
        currentNoteIndex:
          obj.currentNoteIndex !== undefined
            ? BigInt(obj.currentNoteIndex)
            : undefined,
        storageSchemaVersion: obj.storageSchemaVersion
      };
    }
    return await this.emptyAccountState();
  }

  async updateAccountState(accountState: AccountState) {
    if (accountState.currentNoteIndex == undefined) {
      throw new Error("currentNoteIndex must be set.");
    }
    if (!scalarsEqual(accountState.id, await this.getId())) {
      throw new Error("New account id does not match the configured.");
    }
    if (accountState.storageSchemaVersion != storageSchemaVersion) {
      throw new Error(
        `Storage schema version mismatch: ${accountState.storageSchemaVersion} != ${storageSchemaVersion}`
      );
    }
    await this.storage.setItem("accountState", {
      idHash: scalarToBigint(
        await this.cryptoClient.hasher.poseidonHash([accountState.id])
      ),
      nonce: accountState.nonce,
      balance: accountState.balance,
      currentNote: scalarToBigint(accountState.currentNote),
      currentNoteIndex: accountState.currentNoteIndex,
      storageSchemaVersion: accountState.storageSchemaVersion
    });
  }

  async emptyAccountState() {
    return emptyAccountState(await this.getId());
  }

  private async getId(): Promise<Scalar> {
    if (!this.id) {
      this.id = await this.cryptoClient.converter.privateKeyToScalar(
        this.privateKey
      );
    }
    return this.id;
  }
  private async getIdHash(): Promise<Scalar> {
    if (!this.idHash) {
      this.idHash = await this.cryptoClient.hasher.poseidonHash([
        await this.getId()
      ]);
    }
    return this.idHash;
  }
}

const emptyAccountState = (id: Scalar): AccountState => {
  return {
    /// Since the private key is an arbitrary 32byte number, this is a non-reversible mapping
    id,
    nonce: 0n,
    balance: 0n,
    currentNote: Scalar.fromBigint(0n),
    storageSchemaVersion
  };
};
