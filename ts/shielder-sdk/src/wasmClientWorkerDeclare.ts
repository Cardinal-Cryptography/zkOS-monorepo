// worker declaration

import { expose } from "comlink";

import {
  NewAccountReturn,
  NewAccountValues
} from "@/crypto/circuits/newAccount";
import { DepositReturn, DepositValues } from "@/crypto/circuits/deposit";
import { WasmClient, Proof } from "@/wasmClient";
import { Scalar } from "@/crypto/scalar";
import { WithdrawReturn, WithdrawValues } from "@/crypto/circuits/withdraw";
import { ShielderActionSecrets } from "@/crypto/secretGenerator";
import { Hex } from "viem";

export class WasmClientWorker {
  client = new WasmClient();
  threads: number | undefined;

  async init(threads: number): Promise<void> {
    this.threads = threads;
    if (threads < 1) {
      throw new Error("Invalid number of threads");
    }
    if (threads == 1) {
      await this.client.init("web_singlethreaded", threads);
    } else {
      await this.client.init("web_multithreaded", threads);
    }
  }

  proveAndVerifyNewAccount(values: NewAccountValues): NewAccountReturn {
    return this.client.proveAndVerifyNewAccount(values);
  }

  proveAndVerifyDeposit(values: DepositValues): DepositReturn {
    return this.client.proveAndVerifyDeposit(values);
  }

  proveAndVerifyWithdraw(values: WithdrawValues): WithdrawReturn {
    return this.client.proveAndVerifyWithdraw(values);
  }

  proveAndVerifyMerkle(): Proof {
    return this.client.proveAndVerifyMerkle();
  }

  poseidonHash(inputs: Scalar[]): Scalar {
    return this.client.poseidonHash(inputs);
  }

  getSecrets(id: Scalar, nonce: bigint): ShielderActionSecrets {
    return this.client.getSecrets(id, nonce);
  }

  merklePathAndRoot(rawPath: readonly bigint[]): [Uint8Array, Scalar] {
    return this.client.merklePathAndRoot(rawPath);
  }

  privateKeyToScalar(hex: Hex): Scalar {
    return this.client.privateKeyToScalar(hex);
  }

  arity(): number {
    return this.client.arity();
  }
}

const wasmClientWorker = new WasmClientWorker();

expose(wasmClientWorker);
