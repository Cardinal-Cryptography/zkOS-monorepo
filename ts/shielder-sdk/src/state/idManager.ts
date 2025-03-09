import {
  CryptoClient,
  Scalar,
  scalarsEqual
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Hex } from "viem";

export class IdManager {
  private idCache: Map<number, Scalar> = new Map();
  private idHashCache: Map<number, Scalar> = new Map();

  constructor(
    private privateKey: Hex,
    private chainId: bigint,
    private cryptoClient: CryptoClient
  ) {}

  /**
   * Derives and caches an ID for an account index
   */
  async getId(accountIndex: number): Promise<Scalar> {
    let id = this.idCache.get(accountIndex);
    if (!id) {
      id = await this.cryptoClient.secretManager.deriveId(
        this.privateKey,
        this.chainId,
        accountIndex
      );
      this.idCache.set(accountIndex, id);
    }
    return id;
  }

  /**
   * Derives and caches an ID hash for an account index
   */
  async getIdHash(accountIndex: number): Promise<Scalar> {
    let idHash = this.idHashCache.get(accountIndex);
    if (!idHash) {
      const id = await this.getId(accountIndex);
      idHash = await this.cryptoClient.hasher.poseidonHash([id]);
      this.idHashCache.set(accountIndex, idHash);
    }
    return idHash;
  }

  /**
   * Validates that a stored ID hash matches the expected one for an account index
   */
  async validateIdHash(
    accountIndex: number,
    storedIdHash: bigint
  ): Promise<void> {
    const expectedIdHash = await this.getIdHash(accountIndex);
    const storedIdHashScalar = Scalar.fromBigint(storedIdHash);

    if (!scalarsEqual(expectedIdHash, storedIdHashScalar)) {
      throw new Error("ID hash does not match the expected value");
    }
  }
}
