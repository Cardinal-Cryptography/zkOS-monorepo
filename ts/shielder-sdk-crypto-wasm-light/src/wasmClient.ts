import * as singlethreaded_wasm from "shielder_bindings/web-singlethreaded";
import { Hasher } from "@/hasher";
import { SecretGenerator } from "@/secretGenerator";
import { NoteTreeConfig } from "@/noteTreeConfig";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { Converter } from "@/conversion";

export class WasmClient implements CryptoClient {
  threads: number | undefined;
  // newAccountCircuit: NewAccountCircuit;
  // depositCircuit: DepositCircuit;
  // withdrawCircuit: WithdrawCircuit;
  hasher: Hasher;
  secretManager: SecretGenerator;
  noteTreeConfig: NoteTreeConfig;
  converter: Converter;
  initialized: boolean = false;

  constructor() {
    // this.newAccountCircuit = new NewAccountCircuit(prover_service_url);
    // this.depositCircuit = new DepositCircuit(prover_service_url);
    // this.withdrawCircuit = new WithdrawCircuit(prover_service_url);
    this.hasher = new Hasher();
    this.secretManager = new SecretGenerator();
    this.noteTreeConfig = new NoteTreeConfig();
    this.converter = new Converter();
  }

  async init(prover_service_url: string, wasm_url?: string): Promise<void> {
    const time = Date.now();
    await singlethreaded_wasm.default(wasm_url);
    this.initialized = true;
    console.log(`Initialized shielder_bindings in ${Date.now() - time}ms`);
  }
}
