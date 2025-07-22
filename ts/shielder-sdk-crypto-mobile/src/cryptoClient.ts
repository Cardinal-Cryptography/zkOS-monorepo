import {
  DepositCircuit as DepositCircuitGen,
  depositPubInputs,
  deriveId,
  getActionSecrets,
  hex32ToF,
  NewAccountCircuit as NewAccountCircuitGen,
  newAccountPubInputs,
  noteTreeArity,
  noteTreeHeight,
  poseidonHash,
  poseidonRate,
  WithdrawCircuit as WithdrawCircuitGen,
  withdrawPubInputs,
} from './gen';

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

function scalarToArrayBuffer(scalar: Scalar): ArrayBuffer {
  return new Uint8Array(scalar.bytes).buffer;
}

function arrayBufferToScalar(arrayBuffer: ArrayBuffer): Scalar {
  return new Scalar(new Uint8Array(arrayBuffer));
}

export class RNCryptoClient implements CryptoClient {
  private newAccountCircuitGen = NewAccountCircuitGen.newPronto();
  private depositCircuitGen = DepositCircuitGen.newPronto();
  private withdrawCircuitGen = WithdrawCircuitGen.newPronto();
  hasher: Hasher = {
    poseidonHash: async (inputs) => {
      return Promise.resolve().then(() => {
        const mergedBuf = inputs.reduce((acc, input) => {
          return new Uint8Array([...acc, ...input.bytes]);
        }, new Uint8Array());
        const hashArrayBuf = poseidonHash(mergedBuf.buffer);
        return arrayBufferToScalar(hashArrayBuf);
      });
    },
    poseidonRate: async () => {
      return Promise.resolve().then(() => poseidonRate());
    },
  };

  secretManager: SecretManager = {
    getSecrets: async (id, nonce) => {
      return Promise.resolve().then(() => {
        const rawSecrets = getActionSecrets(scalarToArrayBuffer(id), nonce);
        return {
          nullifier: arrayBufferToScalar(rawSecrets.nullifier),
        };
      });
    },
    deriveId: async (privateKey, chainId, accountNonce) => {
      return Promise.resolve(
        arrayBufferToScalar(deriveId(privateKey, chainId, accountNonce))
      );
    },
  };
  noteTreeConfig: NoteTreeConfig = {
    treeHeight: async () => {
      return Promise.resolve(noteTreeHeight());
    },
    arity: async () => {
      return Promise.resolve(noteTreeArity());
    },
  };
  converter: Converter = {
    hex32ToScalar: async (hex) => {
      return Promise.resolve(new Scalar(new Uint8Array(hex32ToF(hex))));
    },
  };
  newAccountCircuit: NewAccountCircuit = {
    prove: async (advice) => {
      return Promise.resolve().then(() => {
        const rawProof = this.newAccountCircuitGen.prove(
          scalarToArrayBuffer(advice.id),
          scalarToArrayBuffer(advice.nullifier),
          scalarToArrayBuffer(advice.initialDeposit),
          scalarToArrayBuffer(advice.commitment),
          scalarToArrayBuffer(advice.tokenAddress),
          scalarToArrayBuffer(advice.encryptionSalt),
          scalarToArrayBuffer(advice.macSalt),
          scalarToArrayBuffer(advice.anonymityRevokerPublicKeyX),
          scalarToArrayBuffer(advice.anonymityRevokerPublicKeyY)
        );
        const rawPubInputs = newAccountPubInputs(
          scalarToArrayBuffer(advice.id),
          scalarToArrayBuffer(advice.nullifier),
          scalarToArrayBuffer(advice.initialDeposit),
          scalarToArrayBuffer(advice.commitment),
          scalarToArrayBuffer(advice.tokenAddress),
          scalarToArrayBuffer(advice.encryptionSalt),
          scalarToArrayBuffer(advice.macSalt),
          scalarToArrayBuffer(advice.anonymityRevokerPublicKeyX),
          scalarToArrayBuffer(advice.anonymityRevokerPublicKeyY)
        );
        return {
          proof: new Uint8Array(rawProof),
          pubInputs: {
            hNote: arrayBufferToScalar(rawPubInputs.hashedNote),
            prenullifier: arrayBufferToScalar(rawPubInputs.prenullifier),
            initialDeposit: arrayBufferToScalar(rawPubInputs.initialDeposit),
            commitment: arrayBufferToScalar(rawPubInputs.commitment),
            tokenAddress: arrayBufferToScalar(rawPubInputs.tokenAddress),
            anonymityRevokerPublicKeyX: arrayBufferToScalar(
              rawPubInputs.anonymityRevokerPublicKeyX
            ),
            anonymityRevokerPublicKeyY: arrayBufferToScalar(
              rawPubInputs.anonymityRevokerPublicKeyY
            ),
            symKeyEncryption1X: arrayBufferToScalar(
              rawPubInputs.symKeyEncryption1X
            ),
            symKeyEncryption1Y: arrayBufferToScalar(
              rawPubInputs.symKeyEncryption1Y
            ),
            symKeyEncryption2X: arrayBufferToScalar(
              rawPubInputs.symKeyEncryption2X
            ),
            symKeyEncryption2Y: arrayBufferToScalar(
              rawPubInputs.symKeyEncryption2Y
            ),
            macSalt: arrayBufferToScalar(rawPubInputs.macSalt),
            macCommitment: arrayBufferToScalar(rawPubInputs.macCommitment),
          },
        };
      });
    },
    verify: async (proof, pubInputs) => {
      return Promise.resolve().then(() => {
        try {
          this.newAccountCircuitGen.verify(
            scalarToArrayBuffer(pubInputs.hNote),
            scalarToArrayBuffer(pubInputs.prenullifier),
            scalarToArrayBuffer(pubInputs.initialDeposit),
            scalarToArrayBuffer(pubInputs.commitment),
            scalarToArrayBuffer(pubInputs.tokenAddress),
            scalarToArrayBuffer(pubInputs.anonymityRevokerPublicKeyX),
            scalarToArrayBuffer(pubInputs.anonymityRevokerPublicKeyY),
            scalarToArrayBuffer(pubInputs.symKeyEncryption1X),
            scalarToArrayBuffer(pubInputs.symKeyEncryption1Y),
            scalarToArrayBuffer(pubInputs.symKeyEncryption2X),
            scalarToArrayBuffer(pubInputs.symKeyEncryption2Y),
            scalarToArrayBuffer(pubInputs.macSalt),
            scalarToArrayBuffer(pubInputs.macCommitment),
            new Uint8Array(proof).buffer
          );
        } catch (e) {
          return false;
        }
        return true;
      });
    },
  };
  depositCircuit: DepositCircuit = {
    prove: async (advice) => {
      return Promise.resolve().then(() => {
        const rawProof = this.depositCircuitGen.prove(
          scalarToArrayBuffer(advice.id),
          scalarToArrayBuffer(advice.nullifierOld),
          scalarToArrayBuffer(advice.accountBalanceOld),
          scalarToArrayBuffer(advice.tokenAddress),
          new Uint8Array(advice.path).buffer,
          scalarToArrayBuffer(advice.value),
          scalarToArrayBuffer(advice.commitment),
          scalarToArrayBuffer(advice.nullifierNew),
          scalarToArrayBuffer(advice.macSalt)
        );

        const rawPubInputs = depositPubInputs(
          scalarToArrayBuffer(advice.id),
          scalarToArrayBuffer(advice.nullifierOld),
          scalarToArrayBuffer(advice.accountBalanceOld),
          scalarToArrayBuffer(advice.tokenAddress),
          new Uint8Array(advice.path).buffer,
          scalarToArrayBuffer(advice.value),
          scalarToArrayBuffer(advice.commitment),
          scalarToArrayBuffer(advice.nullifierNew),
          scalarToArrayBuffer(advice.macSalt)
        );
        return {
          proof: new Uint8Array(rawProof),
          pubInputs: {
            merkleRoot: arrayBufferToScalar(rawPubInputs.merkleRoot),
            hNullifierOld: arrayBufferToScalar(rawPubInputs.hNullifierOld),
            hNoteNew: arrayBufferToScalar(rawPubInputs.hNoteNew),
            value: arrayBufferToScalar(rawPubInputs.value),
            commitment: arrayBufferToScalar(rawPubInputs.commitment),
            tokenAddress: arrayBufferToScalar(rawPubInputs.tokenAddress),
            macSalt: arrayBufferToScalar(rawPubInputs.macSalt),
            macCommitment: arrayBufferToScalar(rawPubInputs.macCommitment),
          },
        };
      });
    },
    verify: async (proof, pubInputs) => {
      return Promise.resolve().then(() => {
        try {
          this.depositCircuitGen.verify(
            scalarToArrayBuffer(pubInputs.merkleRoot),
            scalarToArrayBuffer(pubInputs.hNullifierOld),
            scalarToArrayBuffer(pubInputs.hNoteNew),
            scalarToArrayBuffer(pubInputs.value),
            scalarToArrayBuffer(pubInputs.commitment),
            scalarToArrayBuffer(pubInputs.tokenAddress),
            scalarToArrayBuffer(pubInputs.macSalt),
            scalarToArrayBuffer(pubInputs.macCommitment),
            new Uint8Array(proof).buffer
          );
        } catch (e) {
          return false;
        }
        return true;
      });
    },
  };
  withdrawCircuit: WithdrawCircuit = {
    prove: async (advice) => {
      return Promise.resolve().then(() => {
        const rawProof = this.withdrawCircuitGen.prove(
          scalarToArrayBuffer(advice.id),
          scalarToArrayBuffer(advice.nullifierOld),
          scalarToArrayBuffer(advice.accountBalanceOld),
          scalarToArrayBuffer(advice.tokenAddress),
          new Uint8Array(advice.path).buffer,
          scalarToArrayBuffer(advice.value),
          scalarToArrayBuffer(advice.nullifierNew),
          scalarToArrayBuffer(advice.commitment),
          scalarToArrayBuffer(advice.macSalt)
        );

        const rawPubInputs = withdrawPubInputs(
          scalarToArrayBuffer(advice.id),
          scalarToArrayBuffer(advice.nullifierOld),
          scalarToArrayBuffer(advice.accountBalanceOld),
          scalarToArrayBuffer(advice.tokenAddress),
          new Uint8Array(advice.path).buffer,
          scalarToArrayBuffer(advice.value),
          scalarToArrayBuffer(advice.nullifierNew),
          scalarToArrayBuffer(advice.commitment),
          scalarToArrayBuffer(advice.macSalt)
        );
        return {
          proof: new Uint8Array(rawProof),
          pubInputs: {
            merkleRoot: arrayBufferToScalar(rawPubInputs.merkleRoot),
            hNullifierOld: arrayBufferToScalar(rawPubInputs.hNullifierOld),
            hNoteNew: arrayBufferToScalar(rawPubInputs.hNoteNew),
            value: arrayBufferToScalar(rawPubInputs.withdrawalValue),
            tokenAddress: arrayBufferToScalar(rawPubInputs.tokenAddress),
            commitment: arrayBufferToScalar(rawPubInputs.commitment),
            macSalt: arrayBufferToScalar(rawPubInputs.macSalt),
            macCommitment: arrayBufferToScalar(rawPubInputs.macCommitment),
          },
        };
      });
    },
    verify: async (proof, pubInputs) => {
      return Promise.resolve().then(() => {
        try {
          this.withdrawCircuitGen.verify(
            scalarToArrayBuffer(pubInputs.merkleRoot),
            scalarToArrayBuffer(pubInputs.hNullifierOld),
            scalarToArrayBuffer(pubInputs.hNoteNew),
            scalarToArrayBuffer(pubInputs.value),
            scalarToArrayBuffer(pubInputs.commitment),
            scalarToArrayBuffer(pubInputs.tokenAddress),
            scalarToArrayBuffer(pubInputs.macSalt),
            scalarToArrayBuffer(pubInputs.macCommitment),
            new Uint8Array(proof).buffer
          );
        } catch (e) {
          return false;
        }
        return true;
      });
    },
  };
}
