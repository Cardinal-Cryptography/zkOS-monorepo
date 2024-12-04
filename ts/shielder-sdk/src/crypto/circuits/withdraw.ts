import { encodePacked, hexToBigInt, keccak256 } from "viem";

import { contractVersion } from "@/constants";
import { Scalar, scalarToBigint } from "@/crypto/scalar";
import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";
import { Proof, Caller } from "@/wasmClient";
import { Hasher } from "@/crypto/hasher";
import { idHidingNonce, noteVersion } from "@/utils";

interface PubInputs {
  idHiding: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  merkleRoot: Scalar;
  value: Scalar;
  commitment: Scalar;
}

export interface WithdrawReturn {
  proof: Proof;
  pubInputs: PubInputs;
}

export interface WithdrawValues {
  id: Scalar;
  nullifierOld: Scalar;
  trapdoorOld: Scalar;
  accountBalanceOld: Scalar;
  merkleRoot: Scalar;
  path: Uint8Array;
  value: Scalar;
  nullifierNew: Scalar;
  trapdoorNew: Scalar;
  accountBalanceNew: Scalar;
  relayerAddress: Scalar;
  relayerFee: Scalar;
  address: Scalar;
}

export class Withdraw {
  withdrawCircuit:
    | singleThreadedWasm.WithdrawCircuit
    | multiThreadedWasm.WithdrawCircuit;
  caller: Caller;
  hasher: Hasher;

  constructor(caller: Caller) {
    this.caller = caller;
    if (caller == "web_singlethreaded") {
      this.withdrawCircuit = new singleThreadedWasm.WithdrawCircuit();
    } else if (caller == "web_multithreaded") {
      this.withdrawCircuit = new multiThreadedWasm.WithdrawCircuit();
    } else {
      throw new Error("Invalid caller");
    }
    this.hasher = new Hasher(caller);
  }

  #calculateCommitment(values: WithdrawValues): Scalar {
    const encodingHash = hexToBigInt(
      keccak256(
        encodePacked(
          ["bytes3", "uint256", "uint256", "uint256"],
          [
            contractVersion,
            scalarToBigint(values.address),
            scalarToBigint(values.relayerAddress),
            scalarToBigint(values.relayerFee)
          ]
        )
      )
    );

    // Truncating to fit in the field size, as in the contract.
    const commitment = encodingHash >> 4n;

    return Scalar.fromBigint(commitment);
  }

  #prepareValues(values: WithdrawValues) {
    const version = noteVersion();
    const nonce = idHidingNonce();
    const hId = this.hasher.poseidonHash([values.id]);
    const idHiding = this.hasher.poseidonHash([hId, nonce]);

    const hNullifierOld = this.hasher.poseidonHash([values.nullifierOld]);

    const scalarArray: Scalar[] = new Array<Scalar>(this.hasher.arity()).fill(
      Scalar.fromBigint(0n)
    );
    scalarArray[0] = values.accountBalanceNew;
    const hAccountBalanceNew = this.hasher.poseidonHash(scalarArray);

    const hNoteNew = this.hasher.poseidonHash([
      version,
      values.id,
      values.nullifierNew,
      values.trapdoorNew,
      hAccountBalanceNew
    ]);

    return {
      hNullifierOld,
      hNoteNew,
      commitment: this.#calculateCommitment(values),
      nonce,
      idHiding
    };
  }

  prove(values: WithdrawValues): WithdrawReturn {
    let time = Date.now();
    const { hNullifierOld, hNoteNew, commitment, nonce, idHiding } =
      this.#prepareValues(values);
    console.log(`witness preparation ${Date.now() - time}ms`);
    time = Date.now();
    const proof = this.withdrawCircuit.prove(
      values.id.bytes,
      nonce.bytes,
      values.nullifierOld.bytes,
      values.trapdoorOld.bytes,
      values.accountBalanceOld.bytes,
      values.path,
      values.value.bytes,
      values.nullifierNew.bytes,
      values.trapdoorNew.bytes,
      commitment.bytes
    );
    console.log(`proving ${Date.now() - time}ms`);

    return {
      proof,
      pubInputs: {
        idHiding: idHiding,
        hNullifierOld: hNullifierOld,
        hNoteNew: hNoteNew,
        merkleRoot: values.merkleRoot,
        value: values.value,
        commitment
      }
    };
  }

  verify(proof: Proof, pubInputs: PubInputs) {
    const time = Date.now();
    this.withdrawCircuit.verify(
      pubInputs.idHiding.bytes,
      pubInputs.merkleRoot.bytes,
      pubInputs.hNullifierOld.bytes,
      pubInputs.hNoteNew.bytes,
      pubInputs.value.bytes,
      proof,
      pubInputs.commitment.bytes
    );
    console.log(`verification ${Date.now() - time}ms`);
  }

  proveAndVerify(values: WithdrawValues): WithdrawReturn {
    const result = this.prove(values);
    this.verify(result.proof, result.pubInputs);
    return result;
  }
}
