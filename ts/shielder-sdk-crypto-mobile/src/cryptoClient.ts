import {
  CryptoClient,
  DepositAdvice,
  DepositCircuit,
  DepositPubInputs,
  NewAccountAdvice,
  NewAccountCircuit,
  NewAccountPubInputs,
  Scalar,
  WithdrawAdvice,
  WithdrawCircuit,
  WithdrawPubInputs,
  Hasher,
  SecretManager,
  Converter,
  NoteTreeConfig
} from "@cardinal-cryptography/shielder-sdk-crypto";
import ShielderSdkCryptoMobileModule from "./ShielderSdkCryptoMobileModule";

export class ExpoCryptoClient implements CryptoClient {
  newAccountCircuit: NewAccountCircuit = {
    prove: async (values: NewAccountAdvice<Scalar>) => {
      return ShielderSdkCryptoMobileModule.newAccountProve({
        id: Array.from(values.id.bytes),
        nullifier: Array.from(values.nullifier.bytes),
        trapdoor: Array.from(values.trapdoor.bytes),
        initialDeposit: Array.from(values.initialDeposit.bytes),
        tokenAddress: Array.from(values.tokenAddress.bytes),
        encryptionSalt: Array.from(values.encryptionSalt.bytes),
        anonymityRevokerPublicKeyX: Array.from(
          values.anonymityRevokerPublicKeyX.bytes
        ),
        anonymityRevokerPublicKeyY: Array.from(
          values.anonymityRevokerPublicKeyY.bytes
        )
      });
    },
    pubInputs: async (values: NewAccountAdvice<Scalar>) => {
      const pubInputsBytes =
        await ShielderSdkCryptoMobileModule.newAccountPubInputs({
          id: Array.from(values.id.bytes),
          nullifier: Array.from(values.nullifier.bytes),
          trapdoor: Array.from(values.trapdoor.bytes),
          initialDeposit: Array.from(values.initialDeposit.bytes),
          tokenAddress: Array.from(values.tokenAddress.bytes),
          encryptionSalt: Array.from(values.encryptionSalt.bytes),
          anonymityRevokerPublicKeyX: Array.from(
            values.anonymityRevokerPublicKeyX.bytes
          ),
          anonymityRevokerPublicKeyY: Array.from(
            values.anonymityRevokerPublicKeyY.bytes
          )
        });
      return {
        hNote: new Scalar(new Uint8Array(pubInputsBytes.hNote)),
        hId: new Scalar(new Uint8Array(pubInputsBytes.hId)),
        initialDeposit: new Scalar(
          new Uint8Array(pubInputsBytes.initialDeposit)
        ),
        tokenAddress: new Scalar(new Uint8Array(pubInputsBytes.tokenAddress)),
        anonymityRevokerPublicKeyX: new Scalar(
          new Uint8Array(pubInputsBytes.anonymityRevokerPublicKeyX)
        ),
        anonymityRevokerPublicKeyY: new Scalar(
          new Uint8Array(pubInputsBytes.anonymityRevokerPublicKeyY)
        ),
        symKeyEncryption1X: new Scalar(
          new Uint8Array(pubInputsBytes.symKeyEncryption1X)
        ),
        symKeyEncryption1Y: new Scalar(
          new Uint8Array(pubInputsBytes.symKeyEncryption1Y)
        ),
        symKeyEncryption2X: new Scalar(
          new Uint8Array(pubInputsBytes.symKeyEncryption2X)
        ),
        symKeyEncryption2Y: new Scalar(
          new Uint8Array(pubInputsBytes.symKeyEncryption2Y)
        )
      };
    },
    verify: async (
      proof: Uint8Array,
      pubInputs: NewAccountPubInputs<Scalar>
    ) => {
      try {
        await ShielderSdkCryptoMobileModule.newAccountVerify(
          {
            hNote: Array.from(pubInputs.hNote.bytes),
            hId: Array.from(pubInputs.hId.bytes),
            initialDeposit: Array.from(pubInputs.initialDeposit.bytes),
            tokenAddress: Array.from(pubInputs.tokenAddress.bytes),
            anonymityRevokerPublicKeyX: Array.from(
              pubInputs.anonymityRevokerPublicKeyX.bytes
            ),
            anonymityRevokerPublicKeyY: Array.from(
              pubInputs.anonymityRevokerPublicKeyY.bytes
            ),
            symKeyEncryption1X: Array.from(pubInputs.symKeyEncryption1X.bytes),
            symKeyEncryption1Y: Array.from(pubInputs.symKeyEncryption1Y.bytes),
            symKeyEncryption2X: Array.from(pubInputs.symKeyEncryption2X.bytes),
            symKeyEncryption2Y: Array.from(pubInputs.symKeyEncryption2Y.bytes)
          },
          Array.from(proof)
        );
      } catch {
        return false;
      }
      return true;
    }
  };

  depositCircuit: DepositCircuit = {
    prove: async (values: DepositAdvice<Scalar>) => {
      return ShielderSdkCryptoMobileModule.depositProve({
        id: Array.from(values.id.bytes),
        nonce: Array.from(values.nonce.bytes),
        nullifierOld: Array.from(values.nullifierOld.bytes),
        trapdoorOld: Array.from(values.trapdoorOld.bytes),
        accountBalanceOld: Array.from(values.accountBalanceOld.bytes),
        tokenAddress: Array.from(values.tokenAddress.bytes),
        path: values.path,
        value: Array.from(values.value.bytes),
        nullifierNew: Array.from(values.nullifierNew.bytes),
        trapdoorNew: Array.from(values.trapdoorNew.bytes),
        macSalt: Array.from(values.macSalt.bytes)
      });
    },
    pubInputs: async (values: DepositAdvice<Scalar>) => {
      const pubInputsBytes =
        await ShielderSdkCryptoMobileModule.depositPubInputs({
          id: Array.from(values.id.bytes),
          nonce: Array.from(values.nonce.bytes),
          nullifierOld: Array.from(values.nullifierOld.bytes),
          trapdoorOld: Array.from(values.trapdoorOld.bytes),
          accountBalanceOld: Array.from(values.accountBalanceOld.bytes),
          tokenAddress: Array.from(values.tokenAddress.bytes),
          path: values.path,
          value: Array.from(values.value.bytes),
          nullifierNew: Array.from(values.nullifierNew.bytes),
          trapdoorNew: Array.from(values.trapdoorNew.bytes),
          macSalt: Array.from(values.macSalt.bytes)
        });
      return {
        idHiding: new Scalar(new Uint8Array(pubInputsBytes.idHiding)),
        merkleRoot: new Scalar(new Uint8Array(pubInputsBytes.merkleRoot)),
        hNullifierOld: new Scalar(new Uint8Array(pubInputsBytes.hNullifierOld)),
        hNoteNew: new Scalar(new Uint8Array(pubInputsBytes.hNoteNew)),
        value: new Scalar(new Uint8Array(pubInputsBytes.value)),
        tokenAddress: new Scalar(new Uint8Array(pubInputsBytes.tokenAddress)),
        macSalt: new Scalar(new Uint8Array(pubInputsBytes.macSalt)),
        macCommitment: new Scalar(new Uint8Array(pubInputsBytes.macCommitment))
      };
    },
    verify: async (proof: Uint8Array, pubInputs: DepositPubInputs<Scalar>) => {
      try {
        await ShielderSdkCryptoMobileModule.depositVerify(
          {
            idHiding: Array.from(pubInputs.idHiding.bytes),
            merkleRoot: Array.from(pubInputs.merkleRoot.bytes),
            hNullifierOld: Array.from(pubInputs.hNullifierOld.bytes),
            hNoteNew: Array.from(pubInputs.hNoteNew.bytes),
            value: Array.from(pubInputs.value.bytes),
            tokenAddress: Array.from(pubInputs.tokenAddress.bytes),
            macSalt: Array.from(pubInputs.macSalt.bytes),
            macCommitment: Array.from(pubInputs.macCommitment.bytes)
          },
          Array.from(proof)
        );
      } catch {
        return false;
      }
      return true;
    }
  };

  withdrawCircuit: WithdrawCircuit = {
    prove: async (values: WithdrawAdvice<Scalar>) => {
      return ShielderSdkCryptoMobileModule.withdrawProve({
        id: Array.from(values.id.bytes),
        nonce: Array.from(values.nonce.bytes),
        nullifierOld: Array.from(values.nullifierOld.bytes),
        trapdoorOld: Array.from(values.trapdoorOld.bytes),
        accountBalanceOld: Array.from(values.accountBalanceOld.bytes),
        tokenAddress: Array.from(values.tokenAddress.bytes),
        path: values.path,
        value: Array.from(values.value.bytes),
        nullifierNew: Array.from(values.nullifierNew.bytes),
        trapdoorNew: Array.from(values.trapdoorNew.bytes),
        commitment: Array.from(values.commitment.bytes),
        macSalt: Array.from(values.macSalt.bytes)
      });
    },
    pubInputs: async (values: WithdrawAdvice<Scalar>) => {
      const pubInputsBytes =
        await ShielderSdkCryptoMobileModule.withdrawPubInputs({
          id: Array.from(values.id.bytes),
          nonce: Array.from(values.nonce.bytes),
          nullifierOld: Array.from(values.nullifierOld.bytes),
          trapdoorOld: Array.from(values.trapdoorOld.bytes),
          accountBalanceOld: Array.from(values.accountBalanceOld.bytes),
          tokenAddress: Array.from(values.tokenAddress.bytes),
          path: values.path,
          value: Array.from(values.value.bytes),
          nullifierNew: Array.from(values.nullifierNew.bytes),
          trapdoorNew: Array.from(values.trapdoorNew.bytes),
          commitment: Array.from(values.commitment.bytes),
          macSalt: Array.from(values.macSalt.bytes)
        });
      return {
        idHiding: new Scalar(new Uint8Array(pubInputsBytes.idHiding)),
        merkleRoot: new Scalar(new Uint8Array(pubInputsBytes.merkleRoot)),
        hNullifierOld: new Scalar(new Uint8Array(pubInputsBytes.hNullifierOld)),
        hNoteNew: new Scalar(new Uint8Array(pubInputsBytes.hNoteNew)),
        value: new Scalar(new Uint8Array(pubInputsBytes.value)),
        tokenAddress: new Scalar(new Uint8Array(pubInputsBytes.tokenAddress)),
        commitment: new Scalar(new Uint8Array(pubInputsBytes.commitment)),
        macSalt: new Scalar(new Uint8Array(pubInputsBytes.macSalt)),
        macCommitment: new Scalar(new Uint8Array(pubInputsBytes.macCommitment))
      };
    },
    verify: async (proof: Uint8Array, pubInputs: WithdrawPubInputs<Scalar>) => {
      try {
        await ShielderSdkCryptoMobileModule.withdrawVerify(
          {
            idHiding: Array.from(pubInputs.idHiding.bytes),
            merkleRoot: Array.from(pubInputs.merkleRoot.bytes),
            hNullifierOld: Array.from(pubInputs.hNullifierOld.bytes),
            hNoteNew: Array.from(pubInputs.hNoteNew.bytes),
            value: Array.from(pubInputs.value.bytes),
            tokenAddress: Array.from(pubInputs.tokenAddress.bytes),
            commitment: Array.from(pubInputs.commitment.bytes),
            macSalt: Array.from(pubInputs.macSalt.bytes),
            macCommitment: Array.from(pubInputs.macCommitment.bytes)
          },
          Array.from(proof)
        );
      } catch {
        return false;
      }
      return true;
    }
  };

  hasher: Hasher = {
    poseidonHash: async (inputs: Scalar[]) => {
      const inputBytes = inputs.map((input) => Array.from(input.bytes));
      const result = await ShielderSdkCryptoMobileModule.poseidonHash(
        inputBytes.flat()
      );
      return new Scalar(result);
    },
    poseidonRate: async () => {
      return ShielderSdkCryptoMobileModule.poseidonRate();
    }
  };

  secretManager: SecretManager = {
    getSecrets: async (id: Scalar, nonce: number) => {
      const secretsBytes = await ShielderSdkCryptoMobileModule.getSecrets(
        Array.from(id.bytes),
        nonce
      );
      return {
        nullifier: new Scalar(new Uint8Array(secretsBytes.nullifier)),
        trapdoor: new Scalar(new Uint8Array(secretsBytes.trapdoor))
      };
    },
    deriveId: async (
      privateKey: `0x${string}`,
      tokenAddress: `0x${string}`
    ) => {
      const result = await ShielderSdkCryptoMobileModule.deriveId(
        privateKey,
        tokenAddress
      );
      return new Scalar(result);
    }
  };

  noteTreeConfig: NoteTreeConfig = {
    treeHeight: async () => {
      return ShielderSdkCryptoMobileModule.treeHeight();
    },
    arity: async () => {
      return ShielderSdkCryptoMobileModule.arity();
    }
  };

  converter: Converter = {
    hex32ToScalar: async (hex: `0x${string}`) => {
      const result = await ShielderSdkCryptoMobileModule.hex32ToScalar(hex);
      return new Scalar(result);
    }
  };
}
