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
import { Token } from "@/types";
import { getTokenAddress } from "@/utils";

export class StateManager {
  private storage: StorageInterface;
  private privateKey: Hex;
  private idPerToken: Map<`0x${string}`, Scalar> = new Map();
  private idHashPerToken: Map<`0x${string}`, Scalar> = new Map();
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

  async accountState(token: Token): Promise<AccountState> {
    const tokenAddress = getTokenAddress(token);
    const res = await this.storage.getItem(tokenAddress);
    const id = await this.getId(tokenAddress);

    if (res) {
      const expectedIdHash = await this.getIdHash(tokenAddress);
      const storageIdHash = Scalar.fromBigint(res.idHash);
      if (!scalarsEqual(expectedIdHash, storageIdHash)) {
        throw new Error("Id hash in storage does not matched the configured.");
      }
      const obj = res;
      if (obj.currentNoteIndex === undefined) {
        throw new Error("currentNoteIndex must be set.");
      }
      return {
        id,
        token,
        nonce: BigInt(obj.nonce),
        balance: BigInt(obj.balance),
        currentNote: Scalar.fromBigint(BigInt(obj.currentNote)),
        currentNoteIndex: BigInt(obj.currentNoteIndex),
        storageSchemaVersion: obj.storageSchemaVersion
      };
    }
    return await this.emptyAccountState(token);
  }

  async updateAccountState(token: Token, accountState: AccountState) {
    const tokenAddress = getTokenAddress(token);
    if (accountState.currentNoteIndex == undefined) {
      throw new Error("currentNoteIndex must be set.");
    }
    if (!scalarsEqual(accountState.id, await this.getId(tokenAddress))) {
      throw new Error("New account id does not match the configured.");
    }
    if (accountState.storageSchemaVersion != storageSchemaVersion) {
      throw new Error(
        `Storage schema version mismatch: ${accountState.storageSchemaVersion} != ${storageSchemaVersion}`
      );
    }
    await this.storage.setItem(tokenAddress, {
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

  async emptyAccountState(token: Token): Promise<AccountState> {
    return emptyAccountState(token, await this.getId(getTokenAddress(token)));
  }

  private async getId(tokenAddress: `0x${string}`): Promise<Scalar> {
    let id = this.idPerToken.get(tokenAddress);
    if (!id) {
      id = await this.cryptoClient.secretManager.getIdPerToken(
        this.privateKey,
        tokenAddress
      );
      this.idPerToken.set(tokenAddress, id);
    }
    return id;
  }

  private async getIdHash(tokenAddress: `0x${string}`): Promise<Scalar> {
    let idHash = this.idHashPerToken.get(tokenAddress);
    if (!idHash) {
      idHash = await this.cryptoClient.hasher.poseidonHash([
        await this.getId(tokenAddress)
      ]);
      this.idHashPerToken.set(tokenAddress, idHash);
    }
    return idHash;
  }
}

const emptyAccountState = (token: Token, id: Scalar): AccountState => {
  if (token.type !== "native") {
    throw new Error("Not implemented");
  }
  return {
    /// Since the private key is an arbitrary 32byte number, this is a non-reversible mapping
    id,
    token,
    nonce: 0n,
    balance: 0n,
    currentNote: Scalar.fromBigint(0n),
    storageSchemaVersion
  };
};
