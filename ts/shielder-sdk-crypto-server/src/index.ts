import {
  CryptoClient,
  DepositAdvice,
  DepositPubInputs,
  Hasher,
  NewAccountAdvice,
  NewAccountPubInputs,
  Proof,
  Scalar,
  ShielderActionSecrets,
  WithdrawAdvice,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";

// newAccountCircuit: NewAccountCircuit;
// depositCircuit: DepositCircuit;
// withdrawCircuit: WithdrawCircuit;
// hasher: Hasher;
// secretManager: SecretManager;
// noteTreeConfig: NoteTreeConfig;
// converter: Converter;

async function fetchCryptoServer(url: string, body: object) {
  const headers = { "Content-Type": "application/json" };
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers
  }).then((res) => res.json());
}

export const createServerCryptoClient = (serverUrl: string): CryptoClient => {
  return {
    hasher: {
      poseidonHash: async (inputs: Scalar[]): Promise<Scalar> => {
        return new Scalar(
          await fetchCryptoServer(`${serverUrl}/poseidon_hash`, {
            inputs: Array.from(
              inputs.reduce(
                (acc, input) => new Uint8Array([...acc, ...input.bytes]),
                new Uint8Array()
              )
            )
          })
        );
      },
      poseidonRate: async (): Promise<number> => {
        return fetchCryptoServer(`${serverUrl}/poseidon_rate`, {});
      }
    },
    secretManager: {
      getSecrets: async (
        id: Scalar,
        nonce: number
      ): Promise<ShielderActionSecrets<Scalar>> => {
        const secrets = (await fetchCryptoServer(
          `${serverUrl}/get_action_secrets`,
          {
            id: Array.from(id.bytes),
            nonce
          }
        )) as any;
        return {
          nullifier: new Scalar(secrets.nullifier),
          trapdoor: new Scalar(secrets.trapdoor)
        };
      },
      deriveId: async (
        privateKey: `0x${string}`,
        chainId: bigint,
        accountNonce: number
      ): Promise<Scalar> => {
        return new Scalar(
          await fetchCryptoServer(`${serverUrl}/derive_id`, {
            private_key_hex: privateKey,
            chain_id: Number(chainId),
            account_nonce: accountNonce
          })
        );
      }
    },
    noteTreeConfig: {
      treeHeight: async (): Promise<number> => {
        return fetchCryptoServer(`${serverUrl}/note_tree_height`, {});
      },
      arity: async (): Promise<number> => {
        return fetchCryptoServer(`${serverUrl}/note_tree_arity`, {});
      }
    },
    converter: {
      hex32ToScalar: async (hex: `0x${string}`): Promise<Scalar> => {
        return new Scalar(
          await fetchCryptoServer(`${serverUrl}/hex_32_to_f`, {
            hex
          })
        );
      }
    },
    newAccountCircuit: {
      prove: async (values: NewAccountAdvice<Scalar>): Promise<Proof> => {
        return new Uint8Array(
          (await fetchCryptoServer(`${serverUrl}/NewAccountCircuit.prove`, {
            id: Array.from(values.id.bytes),
            nullifier: Array.from(values.nullifier.bytes),
            trapdoor: Array.from(values.trapdoor.bytes),
            initial_deposit: Array.from(values.initialDeposit.bytes),
            token_address: Array.from(values.tokenAddress.bytes),
            encryption_salt: Array.from(values.encryptionSalt.bytes),
            anonymity_revoker_public_key_x: Array.from(
              values.anonymityRevokerPublicKeyX.bytes
            ),
            anonymity_revoker_public_key_y: Array.from(
              values.anonymityRevokerPublicKeyY.bytes
            ),
            mac_salt: Array.from(values.macSalt.bytes)
          })) as any
        );
      },
      pubInputs: async (
        values: NewAccountAdvice<Scalar>
      ): Promise<NewAccountPubInputs<Scalar>> => {
        const rawPubInputs = (await fetchCryptoServer(
          `${serverUrl}/new_account_pub_inputs`,
          {
            id: Array.from(values.id.bytes),
            nullifier: Array.from(values.nullifier.bytes),
            trapdoor: Array.from(values.trapdoor.bytes),
            initial_deposit: Array.from(values.initialDeposit.bytes),
            token_address: Array.from(values.tokenAddress.bytes),
            encryption_salt: Array.from(values.encryptionSalt.bytes),
            anonymity_revoker_public_key_x: Array.from(
              values.anonymityRevokerPublicKeyX.bytes
            ),
            anonymity_revoker_public_key_y: Array.from(
              values.anonymityRevokerPublicKeyY.bytes
            ),
            mac_salt: Array.from(values.macSalt.bytes)
          }
        )) as any;
        return {
          hNote: new Scalar(rawPubInputs.hashed_note),
          prenullifier: new Scalar(rawPubInputs.prenullifier),
          initialDeposit: new Scalar(rawPubInputs.initial_deposit),
          tokenAddress: new Scalar(rawPubInputs.token_address),
          anonymityRevokerPublicKeyX: new Scalar(
            rawPubInputs.anonymity_revoker_public_key_x
          ),
          anonymityRevokerPublicKeyY: new Scalar(
            rawPubInputs.anonymity_revoker_public_key_y
          ),
          symKeyEncryption1X: new Scalar(rawPubInputs.sym_key_encryption_1_x),
          symKeyEncryption1Y: new Scalar(rawPubInputs.sym_key_encryption_1_y),
          symKeyEncryption2X: new Scalar(rawPubInputs.sym_key_encryption_2_x),
          symKeyEncryption2Y: new Scalar(rawPubInputs.sym_key_encryption_2_y),
          macSalt: new Scalar(rawPubInputs.mac_salt),
          macCommitment: new Scalar(rawPubInputs.mac_commitment)
        };
      },
      verify: async (
        proof: Proof,
        pubInputs: NewAccountPubInputs<Scalar>
      ): Promise<boolean> => {
        const res = (await fetchCryptoServer(
          `${serverUrl}/NewAccountCircuit.verify`,
          {
            h_note: Array.from(pubInputs.hNote.bytes),
            prenullifier: Array.from(pubInputs.prenullifier.bytes),
            initial_deposit: Array.from(pubInputs.initialDeposit.bytes),
            token_address: Array.from(pubInputs.tokenAddress.bytes),
            anonymity_revoker_public_key_x: Array.from(
              pubInputs.anonymityRevokerPublicKeyX.bytes
            ),
            anonymity_revoker_public_key_y: Array.from(
              pubInputs.anonymityRevokerPublicKeyY.bytes
            ),
            sym_key_encryption_1_x: Array.from(
              pubInputs.symKeyEncryption1X.bytes
            ),
            sym_key_encryption_1_y: Array.from(
              pubInputs.symKeyEncryption1Y.bytes
            ),
            sym_key_encryption_2_x: Array.from(
              pubInputs.symKeyEncryption2X.bytes
            ),
            sym_key_encryption_2_y: Array.from(
              pubInputs.symKeyEncryption2Y.bytes
            ),
            mac_salt: Array.from(pubInputs.macSalt.bytes),
            mac_commitment: Array.from(pubInputs.macCommitment.bytes),
            proof: Array.from(proof)
          }
        )) as any;
        if (JSON.stringify(res) == JSON.stringify({ Ok: null })) {
          return true;
        }
        return false;
      }
    },
    depositCircuit: {
      prove: async (values: DepositAdvice<Scalar>): Promise<Proof> => {
        return new Uint8Array(
          (await fetchCryptoServer(`${serverUrl}/DepositCircuit.prove`, {
            id: Array.from(values.id.bytes),
            nullifier_old: Array.from(values.nullifierOld.bytes),
            trapdoor_old: Array.from(values.trapdoorOld.bytes),
            account_balance_old: Array.from(values.accountBalanceOld.bytes),
            token_address: Array.from(values.tokenAddress.bytes),
            path: Array.from(values.path),
            value: Array.from(values.value.bytes),
            nullifier_new: Array.from(values.nullifierNew.bytes),
            trapdoor_new: Array.from(values.trapdoorNew.bytes),
            mac_salt: Array.from(values.macSalt.bytes)
          })) as any
        );
      },
      pubInputs: async (
        values: DepositAdvice<Scalar>
      ): Promise<DepositPubInputs<Scalar>> => {
        const rawPubInputs = (await fetchCryptoServer(
          `${serverUrl}/deposit_pub_inputs`,
          {
            id: Array.from(values.id.bytes),
            nullifier_old: Array.from(values.nullifierOld.bytes),
            trapdoor_old: Array.from(values.trapdoorOld.bytes),
            account_balance_old: Array.from(values.accountBalanceOld.bytes),
            token_address: Array.from(values.tokenAddress.bytes),
            path: Array.from(values.path),
            value: Array.from(values.value.bytes),
            nullifier_new: Array.from(values.nullifierNew.bytes),
            trapdoor_new: Array.from(values.trapdoorNew.bytes),
            mac_salt: Array.from(values.macSalt.bytes)
          }
        )) as any;
        return {
          merkleRoot: new Scalar(rawPubInputs.merkle_root),
          hNullifierOld: new Scalar(rawPubInputs.h_nullifier_old),
          hNoteNew: new Scalar(rawPubInputs.h_note_new),
          value: new Scalar(rawPubInputs.value),
          tokenAddress: new Scalar(rawPubInputs.token_address),
          macSalt: new Scalar(rawPubInputs.mac_salt),
          macCommitment: new Scalar(rawPubInputs.mac_commitment)
        };
      },
      verify: async (
        proof: Proof,
        pubInputs: DepositPubInputs<Scalar>
      ): Promise<boolean> => {
        const res = (await fetchCryptoServer(
          `${serverUrl}/DepositCircuit.verify`,
          {
            merkle_root: Array.from(pubInputs.merkleRoot.bytes),
            h_nullifier_old: Array.from(pubInputs.hNullifierOld.bytes),
            h_note_new: Array.from(pubInputs.hNoteNew.bytes),
            value: Array.from(pubInputs.value.bytes),
            token_address: Array.from(pubInputs.tokenAddress.bytes),
            mac_salt: Array.from(pubInputs.macSalt.bytes),
            mac_commitment: Array.from(pubInputs.macCommitment.bytes),
            proof: Array.from(proof)
          }
        )) as any;
        if (JSON.stringify(res) == JSON.stringify({ Ok: null })) {
          return true;
        }
        return false;
      }
    },
    withdrawCircuit: {
      prove: async (values: WithdrawAdvice<Scalar>): Promise<Proof> => {
        return new Uint8Array(
          (await fetchCryptoServer(`${serverUrl}/WithdrawCircuit.prove`, {
            id: Array.from(values.id.bytes),
            nullifier_old: Array.from(values.nullifierOld.bytes),
            trapdoor_old: Array.from(values.trapdoorOld.bytes),
            account_balance_old: Array.from(values.accountBalanceOld.bytes),
            token_address: Array.from(values.tokenAddress.bytes),
            path: Array.from(values.path),
            value: Array.from(values.value.bytes),
            nullifier_new: Array.from(values.nullifierNew.bytes),
            trapdoor_new: Array.from(values.trapdoorNew.bytes),
            commitment: Array.from(values.commitment.bytes),
            mac_salt: Array.from(values.macSalt.bytes)
          })) as any
        );
      },
      pubInputs: async (
        values: WithdrawAdvice<Scalar>
      ): Promise<WithdrawPubInputs<Scalar>> => {
        const rawPubInputs = (await fetchCryptoServer(
          `${serverUrl}/withdraw_pub_inputs`,
          {
            id: Array.from(values.id.bytes),
            nullifier_old: Array.from(values.nullifierOld.bytes),
            trapdoor_old: Array.from(values.trapdoorOld.bytes),
            account_balance_old: Array.from(values.accountBalanceOld.bytes),
            token_address: Array.from(values.tokenAddress.bytes),
            path: Array.from(values.path),
            value: Array.from(values.value.bytes),
            nullifier_new: Array.from(values.nullifierNew.bytes),
            trapdoor_new: Array.from(values.trapdoorNew.bytes),
            commitment: Array.from(values.commitment.bytes),
            mac_salt: Array.from(values.macSalt.bytes)
          }
        )) as any;
        return {
          merkleRoot: new Scalar(rawPubInputs.merkle_root),
          hNullifierOld: new Scalar(rawPubInputs.h_nullifier_old),
          hNoteNew: new Scalar(rawPubInputs.h_note_new),
          value: new Scalar(rawPubInputs.withdrawal_value),
          tokenAddress: new Scalar(rawPubInputs.token_address),
          commitment: new Scalar(rawPubInputs.commitment),
          macSalt: new Scalar(rawPubInputs.mac_salt),
          macCommitment: new Scalar(rawPubInputs.mac_commitment)
        };
      },
      verify: async (
        proof: Proof,
        pubInputs: WithdrawPubInputs<Scalar>
      ): Promise<boolean> => {
        const res = (await fetchCryptoServer(
          `${serverUrl}/WithdrawCircuit.verify`,
          {
            merkle_root: Array.from(pubInputs.merkleRoot.bytes),
            h_nullifier_old: Array.from(pubInputs.hNullifierOld.bytes),
            h_note_new: Array.from(pubInputs.hNoteNew.bytes),
            value: Array.from(pubInputs.value.bytes),
            token_address: Array.from(pubInputs.tokenAddress.bytes),
            commitment: Array.from(pubInputs.commitment.bytes),
            mac_salt: Array.from(pubInputs.macSalt.bytes),
            mac_commitment: Array.from(pubInputs.macCommitment.bytes),
            proof: Array.from(proof)
          }
        )) as any;
        if (JSON.stringify(res) == JSON.stringify({ Ok: null })) {
          return true;
        }
        return false;
      }
    }
  };
};
