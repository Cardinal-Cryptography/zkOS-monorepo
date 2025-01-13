import {
  Converter,
  CryptoClient,
  DepositCircuit,
  Hasher,
  NewAccountAdvice,
  NewAccountCircuit,
  NewAccountPubInputs,
  NoteTreeConfig,
  Proof,
  Scalar,
  scalarsEqual,
  scalarToBigint,
  SecretManager,
  ShielderActionSecrets,
  WithdrawCircuit
} from "shielder-sdk-crypto";
import { hexToBigInt } from "viem";

const SCALAR_MODULO = 2n ** 64n;
export const ARITY = 7;
export const NOTE_VERSION = 0n;

const mockedHash = (inputs: Scalar[]): Scalar => {
  const sum = inputs.reduce(
    (acc, input) => (acc + scalarToBigint(input) ** 2n) % SCALAR_MODULO,
    BigInt(0)
  );
  return Scalar.fromBigint(sum);
};

const fullArityHash = (inputs: Scalar[]): Scalar => {
  const scalarArray: Scalar[] = new Array<Scalar>(ARITY).fill(
    Scalar.fromBigint(0n)
  );
  inputs.forEach((input, index) => {
    scalarArray[index] = input;
  });
  return mockedHash(scalarArray);
};

export const hashedNote = (
  id: Scalar,
  nullifier: Scalar,
  trapdoor: Scalar,
  amount: Scalar
): Scalar => {
  return mockedHash([
    Scalar.fromBigint(NOTE_VERSION),
    id,
    nullifier,
    trapdoor,
    fullArityHash([amount])
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
    return Promise.resolve(7);
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
    return Promise.resolve(13);
  }

  arity(): Promise<number> {
    return Promise.resolve(7);
  }
}

class MockedNewAccountCircuit implements NewAccountCircuit {
  prove(values: NewAccountAdvice): Promise<Proof> {
    const string = JSON.stringify(values);
    const encoder = new TextEncoder();
    const data = encoder.encode(string);
    return Promise.resolve(data);
  }

  verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean> {
    const proofString = new TextDecoder().decode(proof);
    const advice: NewAccountAdvice = JSON.parse(proofString);

    return Promise.resolve(
      scalarsEqual(pubInputs.hId, mockedHash([advice.id])) &&
        scalarsEqual(
          pubInputs.hNote,
          hashedNote(
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
  prove(): Promise<Proof> {
    return Promise.resolve(new Uint8Array());
  }

  verify(): Promise<boolean> {
    return Promise.resolve(true);
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
