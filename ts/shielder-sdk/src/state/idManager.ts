import {
  CryptoClient,
  Scalar,
  scalarsEqual
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Hex } from "viem";

export class IdManager {
  private idCache: Map<string, Scalar> = new Map();
  private idHashCache: Map<string, Scalar> = new Map();

  constructor(
    private privateKey: Hex,
    private chainId: bigint,
    private cryptoClient: CryptoClient
  ) {}

  /**
   * Derives and caches an ID for an account index
   */
  async getId(tokenAddress: `0x${string}`): Promise<Scalar> {
    let id = this.idCache.get(tokenAddress);
    if (!id) {
      id = await this.cryptoClient.secretManager.deriveId(
        this.privateKey,
        this.chainId,
        tokenAddress
      );
      this.idCache.set(tokenAddress, id);
    }
    return id;
  }

  /**
   * Derives and caches an ID hash for an account index
   */
  async getIdHash(tokenAddress: `0x${string}`): Promise<Scalar> {
    let idHash = this.idHashCache.get(tokenAddress);
    if (!idHash) {
      const id = await this.getId(tokenAddress);
      idHash = await this.cryptoClient.hasher.poseidonHash([id]);
      this.idHashCache.set(tokenAddress, idHash);
    }
    return idHash;
  }

  /**
   * Validates that a stored ID hash matches the expected one for an account index
   */
  async validateIdHash(
    tokenAddress: `0x${string}`,
    storedIdHash: bigint
  ): Promise<void> {
    const expectedIdHash = await this.getIdHash(tokenAddress);
    const storedIdHashScalar = Scalar.fromBigint(storedIdHash);

    if (!scalarsEqual(expectedIdHash, storedIdHashScalar)) {
      throw new Error("ID hash does not match the expected value");
    }
  }
}
