import {
  Converter,
  CryptoClient,
  DepositAdvice,
  DepositCircuit,
  DepositPubInputs,
  Hasher,
  NewAccountAdvice,
  NewAccountCircuit,
  NewAccountPubInputs,
  NoteTreeConfig,
  Proof,
  r,
  Scalar,
  scalarsEqual,
  scalarToBigint,
  SecretManager,
  ShielderActionSecrets,
  WithdrawAdvice,
  WithdrawCircuit,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { hexToBigInt } from "viem";

const SCALAR_MODULO = r;
export const HASH_RATE = 7;
export const NOTE_VERSION = 0n;

const mockedHash = async (inputs: Scalar[]): Promise<Scalar> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(inputs));
  const hash = await crypto.subtle.digest("SHA-256", data);

  const hashArray = new Uint8Array(hash);
  const sum = hashArray.reduce(
    (acc, byte) => (acc * 256n + BigInt(byte)) % SCALAR_MODULO,
    0n
  );
  return Scalar.fromBigint(sum);
};

const fullArityHash = async (inputs: Scalar[]): Promise<Scalar> => {
  const scalarArray: Scalar[] = new Array<Scalar>(HASH_RATE).fill(
    Scalar.fromBigint(0n)
  );
  inputs.forEach((input, index) => {
    scalarArray[index] = input;
  });
  return mockedHash(scalarArray);
};

export const hashedNote = async (
  id: Scalar,
  nullifier: Scalar,
  trapdoor: Scalar,
  amount: Scalar
): Promise<Scalar> => {
  return mockedHash([
    Scalar.fromBigint(NOTE_VERSION),
    id,
    nullifier,
    trapdoor,
    await fullArityHash([amount])
  ]);
};

export class MockedCryptoClient implements CryptoClient {
  newAccountCircuit: NewAccountCircuit;
  depositCircuit: DepositCircuit;
  withdrawCircuit: WithdrawCircuit;
  hasher: Hasher;
  secretManager: SecretManager;
  converter: Converter;
  noteTreeConfig: NoteTreeConfig;

  constructor() {
    this.newAccountCircuit = new MockedNewAccountCircuit();
    this.depositCircuit = new MockedDepositCircuit();
    this.withdrawCircuit = new MockedWithdrawCircuit();
    this.hasher = new MockedHasher();
    this.secretManager = new MockedSecretManager();
    this.converter = new MockedConverter();
    this.noteTreeConfig = new MockedNoteTreeConfig();
  }
}

class MockedHasher implements Hasher {
  poseidonHash(inputs: Scalar[]): Promise<Scalar> {
    return Promise.resolve(mockedHash(inputs));
  }

  poseidonRate(): Promise<number> {
    return Promise.resolve(HASH_RATE);
  }
}

class MockedSecretManager implements SecretManager {
  async getSecrets(id: Scalar, nonce: number): Promise<ShielderActionSecrets> {
    return {
      nullifier: await mockedHash([
        id,
        Scalar.fromBigint(BigInt(nonce)),
        Scalar.fromBigint(0n)
      ]),
      trapdoor: await mockedHash([
        id,
        Scalar.fromBigint(BigInt(nonce)),
        Scalar.fromBigint(1n)
      ])
    };
  }
}

class MockedConverter implements Converter {
  privateKeyToScalar(hex: `0x${string}`): Promise<Scalar> {
    return Promise.resolve(Scalar.fromBigint(hexToBigInt(hex) % SCALAR_MODULO));
  }
}

class MockedNoteTreeConfig implements NoteTreeConfig {
  treeHeight(): Promise<number> {
    return Promise.resolve(1);
  }

  arity(): Promise<number> {
    return Promise.resolve(2);
  }
}

class MockedNewAccountCircuit implements NewAccountCircuit {
  prove(values: NewAccountAdvice): Promise<Proof> {
    return Promise.resolve(new Uint8Array());
  }

  pubInputs(values: NewAccountAdvice): Promise<NewAccountPubInputs> {
    return Promise.resolve({
      hNote: Scalar.fromBigint(0n),
      hId: Scalar.fromBigint(0n),
      initialDeposit: Scalar.fromBigint(0n),
      tokenAddress: Scalar.fromBigint(0n),
      anonymityRevokerPubkey: {
        x: Scalar.fromBigint(0n),
        y: Scalar.fromBigint(0n)
      },
      symKeyEncryption: Scalar.fromBigint(0n)
    });
  }

  async verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class MockedDepositCircuit implements DepositCircuit {
  prove(values: DepositAdvice): Promise<Proof> {
    return Promise.resolve(new Uint8Array());
  }

  pubInputs(values: DepositAdvice): Promise<DepositPubInputs> {
    return Promise.resolve({
      idHiding: Scalar.fromBigint(0n),
      merkleRoot: Scalar.fromBigint(0n),
      hNullifierOld: Scalar.fromBigint(0n),
      hNoteNew: Scalar.fromBigint(0n),
      value: Scalar.fromBigint(0n),
      tokenAddress: Scalar.fromBigint(0n),
      macSalt: Scalar.fromBigint(0n),
      macCommitment: Scalar.fromBigint(0n)
    });
  }

  async verify(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class MockedWithdrawCircuit implements WithdrawCircuit {
  prove(): Promise<Proof> {
    return Promise.resolve(new Uint8Array());
  }

  pubInputs(values: WithdrawAdvice): Promise<WithdrawPubInputs> {
    return Promise.resolve({
      idHiding: Scalar.fromBigint(0n),
      merkleRoot: Scalar.fromBigint(0n),
      hNullifierOld: Scalar.fromBigint(0n),
      hNoteNew: Scalar.fromBigint(0n),
      value: Scalar.fromBigint(0n),
      tokenAddress: Scalar.fromBigint(0n),
      commitment: Scalar.fromBigint(0n),
      macSalt: Scalar.fromBigint(0n),
      macCommitment: Scalar.fromBigint(0n)
    });
  }

  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
