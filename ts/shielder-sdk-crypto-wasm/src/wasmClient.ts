import * as singlethreaded_wasm from "shielder-wasm/web-singlethreaded";
import * as multithreaded_wasm from "shielder-wasm/web-multithreaded";
import { Scalar } from "shielder-sdk-crypto";
import { NewAccount } from "@/circuits/newAccount";
import { Deposit } from "@/circuits/deposit";
import { Withdraw } from "@/circuits/withdraw";
import { Hasher } from "@/hasher";
import { SecretGenerator } from "@/secretGenerator";
import { Converter } from "@/conversion";
import { Hex } from "viem";
import {
  DepositPubInputs,
  DepositValues,
  NewAccountPubInputs,
  NewAccountValues,
  ShielderActionSecrets,
  WithdrawPubInputs,
  WithdrawValues,
  Proof
} from "shielder-sdk-crypto";

export type Caller = "web_singlethreaded" | "web_multithreaded";

export class WasmClient {
  threads: number | undefined;
  newAccount: NewAccount | undefined;
  deposit: Deposit | undefined;
  withdraw: Withdraw | undefined;
  hasher: Hasher | undefined;
  secretGenerator: SecretGenerator | undefined;
  converter: Converter | undefined;
  initialized: boolean = false;

  async init(caller: Caller, threads: number): Promise<void> {
    const time = Date.now();
    this.threads = threads;
    if (caller == "web_singlethreaded") {
      await singlethreaded_wasm.default();
    } else if (caller == "web_multithreaded") {
      await multithreaded_wasm.default();
      await multithreaded_wasm.initThreadPool(threads);
    } else {
      throw new Error("Invalid caller");
    }
    this.newAccount = new NewAccount(caller);
    this.deposit = new Deposit(caller);
    this.withdraw = new Withdraw(caller);
    this.hasher = new Hasher(caller);
    this.secretGenerator = new SecretGenerator(caller);
    this.converter = new Converter(caller);
    this.initialized = true;
    if (caller == "web_singlethreaded") {
      console.log(`Initialized shielder-wasm in ${Date.now() - time}ms`);
    } else {
      console.log(
        `Initialized shielder-wasm with ${threads} threads in ${Date.now() - time}ms`
      );
    }
  }

  proveNewAccount = (values: NewAccountValues): Proof => {
    return this.newAccount!.prove(values);
  };

  verifyNewAccount = (
    proof: Proof,
    pubInputs: NewAccountPubInputs
  ): boolean => {
    return this.newAccount!.verify(proof, pubInputs);
  };

  proveDeposit = (values: DepositValues): Proof => {
    return this.deposit!.prove(values);
  };

  verifyDeposit(proof: Proof, pubInputs: DepositPubInputs): boolean {
    return this.deposit!.verify(proof, pubInputs);
  }

  proveWithdraw(values: WithdrawValues): Proof {
    return this.withdraw!.prove(values);
  }

  verifyWithdraw(proof: Proof, pubInputs: WithdrawPubInputs): boolean {
    return this.withdraw!.verify(proof, pubInputs);
  }

  poseidonHash(inputs: Scalar[]): Scalar {
    return this.hasher!.poseidonHash(inputs);
  }

  getSecrets(id: Scalar, nonce: number): ShielderActionSecrets {
    return this.secretGenerator!.getSecrets(id, nonce);
  }

  arity(): number {
    return this.hasher!.arity();
  }

  treeHeight(): number {
    return this.hasher!.treeHeight();
  }

  privateKeyToScalar(hex: Hex): Scalar {
    return this.converter!.privateKeyToScalar(hex);
  }
}
