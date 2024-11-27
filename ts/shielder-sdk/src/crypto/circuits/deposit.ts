import { Scalar } from "@/crypto/scalar";
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
}

export interface DepositReturn {
  proof: Proof;
  pubInputs: PubInputs;
}

export interface DepositValues {
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
}

export class Deposit {
  depositCircuit:
    | singleThreadedWasm.DepositCircuit
    | multiThreadedWasm.DepositCircuit
    | undefined;
  caller: Caller;
  hasher: Hasher;

  constructor(caller: Caller) {
    this.caller = caller;
    if (caller == "web_singlethreaded") {
      this.depositCircuit = new singleThreadedWasm.DepositCircuit();
    } else if (caller == "web_multithreaded") {
      this.depositCircuit = new multiThreadedWasm.DepositCircuit();
    } else {
      throw new Error("Invalid caller");
    }
    this.hasher = new Hasher(caller);
  }

  #prepareValues(values: DepositValues) {
    const nonce = idHidingNonce();
    const version = noteVersion();
    const hId = this.hasher.poseidonHash([values.id]);
    const idHiding = this.hasher.poseidonHash([hId, nonce]);

    const hNullifierOld = this.hasher.poseidonHash([values.nullifierOld]);
    const hAccountBalanceNew = this.hasher.poseidonHash([
      values.accountBalanceNew
    ]);
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
      nonce,
      idHiding
    };
  }

  prove(values: DepositValues): DepositReturn {
    let time = Date.now();
    const { hNullifierOld, hNoteNew, nonce, idHiding } =
      this.#prepareValues(values);
    console.log(`witness preparation ${Date.now() - time}ms`);

    time = Date.now();
    const proof = this.depositCircuit!.prove(
      values.id.bytes,
      nonce.bytes,
      values.nullifierOld.bytes,
      values.trapdoorOld.bytes,
      values.accountBalanceOld.bytes,
      values.path,
      values.value.bytes,
      values.nullifierNew.bytes,
      values.trapdoorNew.bytes
    );
    console.log(`actual proving ${Date.now() - time}ms`);

    return {
      proof,
      pubInputs: {
        idHiding: idHiding,
        hNullifierOld: hNullifierOld,
        hNoteNew: hNoteNew,
        merkleRoot: values.merkleRoot,
        value: values.value
      }
    };
  }

  verify(proof: Proof, pubInputs: PubInputs) {
    const time = Date.now();
    this.depositCircuit!.verify(
      pubInputs.idHiding.bytes,
      pubInputs.merkleRoot.bytes,
      pubInputs.hNullifierOld.bytes,
      pubInputs.hNoteNew.bytes,
      pubInputs.value.bytes,
      proof
    );
    console.log(`verification ${Date.now() - time}ms`);
  }

  proveAndVerify(values: DepositValues): DepositReturn {
    const result = this.prove(values);
    this.verify(result.proof, result.pubInputs);
    return result;
  }
}
