import { expect, describe, it, beforeEach } from "vitest";

import { createServerCryptoClient } from "../src/index";
import {
  CryptoClient,
  Scalar,
  scalarsEqual
} from "@cardinal-cryptography/shielder-sdk-crypto";

const SERVER_URL = "https://shielder-sdk.zubec.xyz";

describe("ServerCryptoClient", () => {
  let cryptoClient: CryptoClient;
  beforeEach(() => {
    cryptoClient = createServerCryptoClient(SERVER_URL);
  });
  describe("Hash", () => {
    it("should fetch poseidonHash", async () => {
      const hash = await cryptoClient.hasher.poseidonHash([
        Scalar.fromBigint(1n),
        Scalar.fromBigint(2n)
      ]);
      expect(
        scalarsEqual(
          hash,
          new Scalar(
            new Uint8Array([
              19, 19, 150, 213, 87, 67, 230, 65, 114, 82, 254, 93, 15, 161, 133,
              167, 86, 161, 214, 113, 83, 63, 219, 60, 232, 133, 158, 235, 175,
              150, 74, 15
            ])
          )
        )
      ).toBe(true);
    });
    it("should fetch poseidonRate", async () => {
      const rate = await cryptoClient.hasher.poseidonRate();
      expect(rate).toBe(7);
    });
  });

  describe("Secrets", () => {
    it("should fetch secrets", async () => {
      const secrets = await cryptoClient.secretManager.getSecrets(
        Scalar.fromBigint(1n),
        0
      );
      expect(
        scalarsEqual(
          secrets.nullifier,
          new Scalar(
            new Uint8Array([
              71, 179, 242, 178, 243, 207, 92, 34, 139, 9, 199, 212, 124, 74,
              36, 70, 246, 93, 146, 7, 239, 52, 95, 225, 90, 212, 92, 194, 168,
              91, 167, 37
            ])
          )
        )
      ).toBe(true);
      expect(
        scalarsEqual(
          secrets.trapdoor,
          new Scalar(
            new Uint8Array([
              37, 30, 253, 7, 59, 136, 2, 233, 3, 237, 60, 76, 45, 247, 0, 202,
              98, 0, 141, 197, 251, 210, 33, 162, 7, 111, 254, 195, 194, 69,
              121, 22
            ])
          )
        )
      ).toBe(true);
    });

    it("should fetch deriveId", async () => {
      const id = await cryptoClient.secretManager.deriveId("0x1", 1n, 0);
      expect(
        scalarsEqual(
          id,
          new Scalar(
            new Uint8Array([
              25, 132, 134, 93, 146, 148, 245, 220, 219, 241, 65, 0, 31, 35, 63,
              171, 125, 28, 22, 84, 233, 198, 187, 46, 218, 187, 208, 79, 59,
              209, 137, 31
            ])
          )
        )
      ).toBe(true);
    });
  });

  describe("NoteTree", () => {
    it("should fetch treeHeight", async () => {
      const height = await cryptoClient.noteTreeConfig.treeHeight();
      expect(height).toBe(13);
    });
    it("should fetch arity", async () => {
      const arity = await cryptoClient.noteTreeConfig.arity();
      expect(arity).toBe(7);
    });
  });

  describe("Converter", () => {
    it("should fetch hex32ToScalar", async () => {
      const scalar = await cryptoClient.converter.hex32ToScalar(
        "0xa59dd6d68b18d9b857c118b44c63e112ac8e5d3b153a985922ef664e1490fbe5"
      );
      expect(
        scalarsEqual(
          scalar,
          new Scalar(
            new Uint8Array([
              226, 251, 144, 68, 146, 133, 73, 87, 165, 70, 14, 168, 97, 164,
              242, 51, 251, 215, 223, 199, 144, 71, 208, 46, 59, 249, 131, 231,
              125, 235, 112, 20
            ])
          )
        )
      ).toBe(true);
    });
  });

  describe("NewAccountCircuit", () => {
    const advice = {
      id: Scalar.fromBigint(1n),
      nullifier: Scalar.fromBigint(2n),
      trapdoor: Scalar.fromBigint(3n),
      initialDeposit: Scalar.fromBigint(4n),
      tokenAddress: Scalar.fromBigint(5n),
      encryptionSalt: Scalar.fromBigint(6n),
      anonymityRevokerPublicKeyX: Scalar.fromBigint(7n),
      anonymityRevokerPublicKeyY: Scalar.fromBigint(8n),
      macSalt: Scalar.fromBigint(9n)
    };
    it("should prove, pubInputs & verify", async () => {
      const proof = await cryptoClient.newAccountCircuit.prove(advice);
      expect(proof).toBeInstanceOf(Uint8Array);
      const pubInputs = await cryptoClient.newAccountCircuit.pubInputs(advice);
      const verified = await cryptoClient.newAccountCircuit.verify(
        proof,
        pubInputs
      );
      expect(verified).toBe(true);
    });
    it("should fail to verify with wrong proof", async () => {
      const proof = await cryptoClient.newAccountCircuit.prove(advice);
      if (proof[0] == 0) proof[0] = 1;
      else proof[0] = 0;
      const pubInputs = await cryptoClient.newAccountCircuit.pubInputs(advice);
      const verified = await cryptoClient.newAccountCircuit.verify(
        proof,
        pubInputs
      );
      expect(verified).toBe(false);
    });
  });

  describe("DepositCircuit", () => {
    async function getPath() {
      const advice = {
        id: Scalar.fromBigint(1n),
        nullifier: Scalar.fromBigint(2n),
        trapdoor: Scalar.fromBigint(3n),
        initialDeposit: Scalar.fromBigint(4n),
        tokenAddress: Scalar.fromBigint(5n),
        encryptionSalt: Scalar.fromBigint(6n),
        anonymityRevokerPublicKeyX: Scalar.fromBigint(7n),
        anonymityRevokerPublicKeyY: Scalar.fromBigint(8n),
        macSalt: Scalar.fromBigint(9n)
      };
      const newAccountPub =
        await cryptoClient.newAccountCircuit.pubInputs(advice);

      let lastRoot = newAccountPub.hNote;
      let path = new Uint8Array();
      for (let i = 0; i < 13; i++) {
        const level: Scalar[] = [];
        for (let j = 0; j < 7; j++) {
          level.push(Scalar.fromBigint(0n));
        }
        level[0] = lastRoot;
        let levelUint8Array = new Uint8Array();
        for (let j = 0; j < 7; j++) {
          levelUint8Array = new Uint8Array([
            ...levelUint8Array,
            ...level[j].bytes
          ]);
        }
        path = new Uint8Array([...path, ...levelUint8Array]);
        lastRoot = await cryptoClient.hasher.poseidonHash(level);
      }

      return path;
    }
    async function getAdvice() {
      return {
        id: Scalar.fromBigint(1n),
        nullifierOld: Scalar.fromBigint(2n),
        trapdoorOld: Scalar.fromBigint(3n),
        accountBalanceOld: Scalar.fromBigint(4n),
        tokenAddress: Scalar.fromBigint(5n),
        path: await getPath(),
        value: Scalar.fromBigint(6n),
        nullifierNew: Scalar.fromBigint(7n),
        trapdoorNew: Scalar.fromBigint(8n),
        macSalt: Scalar.fromBigint(9n)
      };
    }
    it("should prove, pubInputs & verify", async () => {
      const advice = await getAdvice();
      const proof = await cryptoClient.depositCircuit.prove(advice);
      expect(proof).toBeInstanceOf(Uint8Array);
      const pubInputs = await cryptoClient.depositCircuit.pubInputs(advice);
      const verified = await cryptoClient.depositCircuit.verify(
        proof,
        pubInputs
      );
      expect(verified).toBe(true);
    });
    it("should fail to verify with wrong proof", async () => {
      const advice = await getAdvice();
      const proof = await cryptoClient.depositCircuit.prove(advice);
      if (proof[0] == 0) proof[0] = 1;
      else proof[0] = 0;
      const pubInputs = await cryptoClient.depositCircuit.pubInputs(advice);
      const verified = await cryptoClient.depositCircuit.verify(
        proof,
        pubInputs
      );
      expect(verified).toBe(false);
    });
  });

  describe("WithdrawCircuit", () => {
    async function getPath() {
      const advice = {
        id: Scalar.fromBigint(1n),
        nullifier: Scalar.fromBigint(2n),
        trapdoor: Scalar.fromBigint(3n),
        initialDeposit: Scalar.fromBigint(4n),
        tokenAddress: Scalar.fromBigint(5n),
        encryptionSalt: Scalar.fromBigint(6n),
        anonymityRevokerPublicKeyX: Scalar.fromBigint(7n),
        anonymityRevokerPublicKeyY: Scalar.fromBigint(8n),
        macSalt: Scalar.fromBigint(9n)
      };
      const newAccountPub =
        await cryptoClient.newAccountCircuit.pubInputs(advice);

      let lastRoot = newAccountPub.hNote;
      let path = new Uint8Array();
      for (let i = 0; i < 13; i++) {
        const level: Scalar[] = [];
        for (let j = 0; j < 7; j++) {
          level.push(Scalar.fromBigint(0n));
        }
        level[0] = lastRoot;
        let levelUint8Array = new Uint8Array();
        for (let j = 0; j < 7; j++) {
          levelUint8Array = new Uint8Array([
            ...levelUint8Array,
            ...level[j].bytes
          ]);
        }
        path = new Uint8Array([...path, ...levelUint8Array]);
        lastRoot = await cryptoClient.hasher.poseidonHash(level);
      }
      return path;
    }
    async function getAdvice() {
      return {
        id: Scalar.fromBigint(1n),
        nullifierOld: Scalar.fromBigint(2n),
        trapdoorOld: Scalar.fromBigint(3n),
        accountBalanceOld: Scalar.fromBigint(4n),
        tokenAddress: Scalar.fromBigint(5n),
        path: await getPath(),
        value: Scalar.fromBigint(1n),
        nullifierNew: Scalar.fromBigint(7n),
        trapdoorNew: Scalar.fromBigint(8n),
        commitment: Scalar.fromBigint(9n),
        macSalt: Scalar.fromBigint(9n)
      };
    }
    it("should prove, pubInputs & verify", async () => {
      const advice = await getAdvice();
      const proof = await cryptoClient.withdrawCircuit.prove(advice);
      expect(proof).toBeInstanceOf(Uint8Array);
      const pubInputs = await cryptoClient.withdrawCircuit.pubInputs(advice);
      const verified = await cryptoClient.withdrawCircuit.verify(
        proof,
        pubInputs
      );
      expect(verified).toBe(true);
    });
    it("should fail to verify with wrong proof", async () => {
      const advice = await getAdvice();
      const proof = await cryptoClient.withdrawCircuit.prove(advice);
      if (proof[0] == 0) proof[0] = 1;
      else proof[0] = 0;
      const pubInputs = await cryptoClient.withdrawCircuit.pubInputs(advice);
      const verified = await cryptoClient.withdrawCircuit.verify(
        proof,
        pubInputs
      );
      expect(verified).toBe(false);
    });
  });
});
