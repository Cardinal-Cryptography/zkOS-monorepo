import { poseidonHash, poseidonRate } from './gen';

import {
  Scalar,
  type Converter,
  type CryptoClient,
  type DepositCircuit,
  type Hasher,
  type NewAccountCircuit,
  type NoteTreeConfig,
  type SecretManager,
  type WithdrawCircuit,
} from '@cardinal-cryptography/shielder-sdk-crypto';

export class RNCryptoClient implements CryptoClient {
  hasher: Hasher = {
    poseidonHash: async (inputs: Scalar[]): Promise<Scalar> => {
      return Promise.resolve().then(() => {
        const mergedBuf = inputs.reduce((acc, input) => {
          return new Uint8Array([...acc, ...input.bytes]);
        }, new Uint8Array());
        const hashArrayBuf = poseidonHash(mergedBuf.buffer);
        return new Scalar(new Uint8Array(hashArrayBuf));
      });
    },
    poseidonRate: async (): Promise<number> => {
      return Promise.resolve().then(() => poseidonRate());
    },
  };
  secretManager: SecretManager = {} as SecretManager;
  noteTreeConfig: NoteTreeConfig = {} as NoteTreeConfig;
  converter: Converter = {} as Converter;
  newAccountCircuit: NewAccountCircuit = {} as NewAccountCircuit;
  depositCircuit: DepositCircuit = {} as DepositCircuit;
  withdrawCircuit: WithdrawCircuit = {} as WithdrawCircuit;
}
