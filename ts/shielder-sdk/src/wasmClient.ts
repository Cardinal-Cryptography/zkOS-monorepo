import * as singlethreaded_wasm from "shielder-wasm/web-singlethreaded";
import * as multithreaded_wasm from "shielder-wasm/web-multithreaded";
import { Scalar } from "@/crypto/scalar";
import {
  NewAccount,
  NewAccountReturn,
  NewAccountValues
} from "@/crypto/circuits/newAccount";
import {
  Deposit,
  DepositReturn,
  DepositValues
} from "@/crypto/circuits/deposit";
import {
  Withdraw,
  WithdrawReturn,
  WithdrawValues
} from "@/crypto/circuits/withdraw";
import { Merkle } from "@/crypto/circuits/merkle";
import { Hasher } from "@/crypto/hasher";
import {
  SecretGenerator,
  ShielderActionSecrets
} from "@/crypto/secretGenerator";
import { flatUint8 } from "@/utils";
import { Converter } from "@/crypto/conversion";
import { Hex } from "viem";

export type Caller = "web_singlethreaded" | "web_multithreaded";
export type Proof = Uint8Array;

export type {
  NewAccountReturn,
  DepositReturn,
  NewAccountValues,
  DepositValues,
  SecretGenerator,
  ShielderActionSecrets
};

export class WasmClient {
  threads: number | undefined;
  newAccount: NewAccount | undefined;
  deposit: Deposit | undefined;
  withdraw: Withdraw | undefined;
  merkle: Merkle | undefined;
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
    this.merkle = new Merkle(caller);
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

  proveAndVerifyNewAccount = (values: NewAccountValues): NewAccountReturn => {
    return this.newAccount!.proveAndVerify(values);
  };

  proveAndVerifyDeposit(values: DepositValues): DepositReturn {
    return this.deposit!.proveAndVerify(values);
  }

  proveAndVerifyWithdraw(values: WithdrawValues): WithdrawReturn {
    return this.withdraw!.proveAndVerify(values);
  }

  proveAndVerifyMerkle(): Proof {
    return this.merkle!.proveAndVerify();
  }

  poseidonHash(inputs: Scalar[]): Scalar {
    return this.hasher!.poseidonHash(inputs);
  }

  getSecrets(id: Scalar, nonce: bigint): ShielderActionSecrets {
    return this.secretGenerator!.getSecrets(id, nonce);
  }

  merklePathAndRoot(rawPath: readonly bigint[]): [Uint8Array, Scalar] {
    if (
      rawPath.length !=
      this.hasher!.treeHeight() * this.hasher!.arity() + 1
    ) {
      throw new Error("Wrong path length");
    }
    const mappedPath = rawPath.map((x) => Scalar.fromBigint(x));
    const path = flatUint8(mappedPath.slice(0, -1).map((x) => x.bytes));
    const root = mappedPath[mappedPath.length - 1];
    return [path, root];
  }

  privateKeyToScalar(hex: Hex): Scalar {
    return this.converter!.privateKeyToScalar(hex);
  }

  arity(): number {
    return this.hasher!.arity();
  }
}
