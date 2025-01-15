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
  WithdrawCircuit
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
  getSecrets(id: Scalar, nonce: number): Promise<ShielderActionSecrets> {
    return Promise.resolve({
      nullifier: Scalar.fromBigint(scalarToBigint(id) + BigInt(nonce) * 2n),
      trapdoor: Scalar.fromBigint(scalarToBigint(id) + BigInt(nonce) * 2n + 1n)
    });
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
    const string = JSON.stringify(values);
    const encoder = new TextEncoder();
    const data = encoder.encode(string);
    return Promise.resolve(data);
  }

  async verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean> {
    const proofString = new TextDecoder().decode(proof);
    const advice: NewAccountAdvice = JSON.parse(proofString);

    return (
      scalarsEqual(pubInputs.hId, await mockedHash([advice.id])) &&
      scalarsEqual(
        pubInputs.hNote,
        await hashedNote(
          advice.id,
          advice.nullifier,
          advice.trapdoor,
          advice.initialDeposit
        )
      ) &&
      scalarsEqual(pubInputs.initialDeposit, advice.initialDeposit)
    );
  }
}

class MockedDepositCircuit implements DepositCircuit {
  prove(values: DepositAdvice): Promise<Proof> {
    const string = JSON.stringify({ ...values, path: Array.from(values.path) });
    const encoder = new TextEncoder();
    const data = encoder.encode(string);
    return Promise.resolve(data);
  }

  async verify(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean> {
    const proofString = new TextDecoder().decode(proof);
    const advice: DepositAdvice = JSON.parse(proofString, (key, value) => {
      if (key === "path") {
        return new Uint8Array(value);
      }
      return value;
    });
    const hId = await mockedHash([advice.id]);
    const idHiding = await mockedHash([hId, advice.nonce]);
    return (
      scalarsEqual(pubInputs.idHiding, idHiding) &&
      scalarsEqual(
        pubInputs.merkleRoot,
        await mockedHash([
          new Scalar(advice.path.slice(0, 32)),
          new Scalar(advice.path.slice(32, 64))
        ])
      ) &&
      scalarsEqual(
        pubInputs.hNullifierOld,
        await mockedHash([advice.nullifierOld])
      ) &&
      scalarsEqual(
        pubInputs.hNoteNew,
        await hashedNote(
          advice.id,
          advice.nullifierNew,
          advice.trapdoorNew,
          Scalar.fromBigint(
            scalarToBigint(advice.accountBalanceOld) +
              scalarToBigint(advice.value)
          )
        )
      ) &&
      scalarsEqual(pubInputs.value, advice.value)
    );
  }
}

class MockedWithdrawCircuit implements WithdrawCircuit {
  prove(): Promise<Proof> {
    return Promise.resolve(new Uint8Array());
  }

  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
