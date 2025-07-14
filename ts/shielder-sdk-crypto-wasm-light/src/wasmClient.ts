import * as singlethreaded_wasm from "shielder_bindings/web-singlethreaded";
import { Hasher } from "@/hasher";
import { SecretGenerator } from "@/secretGenerator";
import { NoteTreeConfig } from "@/noteTreeConfig";
import { Converter } from "@/conversion";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { NewAccountTeeCircuit } from "./circuits/newAccount";
import { DepositTeeCircuit } from "./circuits/deposit";
import { WithdrawTeeCircuit } from "./circuits/withdraw";
import { TeeClient } from "./circuits/teeClient";

export class WasmClient implements CryptoClient {
  threads: number | undefined;
  newAccountCircuit: NewAccountTeeCircuit;
  depositCircuit: DepositTeeCircuit;
  withdrawCircuit: WithdrawTeeCircuit;
  hasher: Hasher;
  secretManager: SecretGenerator;
  noteTreeConfig: NoteTreeConfig;
  converter: Converter;
  teeClient: TeeClient;
  initialized: boolean = false;

  constructor() {
    this.teeClient = new TeeClient();
    this.newAccountCircuit = new NewAccountTeeCircuit(this.teeClient);
    this.depositCircuit = new DepositTeeCircuit(this.teeClient);
    this.withdrawCircuit = new WithdrawTeeCircuit(this.teeClient);
    this.hasher = new Hasher();
    this.secretManager = new SecretGenerator();
    this.noteTreeConfig = new NoteTreeConfig();
    this.converter = new Converter();
  }

  async init(
    proverServiceUrl: string,
    withoutAttestation?: boolean,
    wasmUrl?: string
  ): Promise<void> {
    const time = Date.now();
    await singlethreaded_wasm.default(wasmUrl);
    await this.teeClient.init(proverServiceUrl, withoutAttestation ?? false);
    this.initialized = true;
    console.log(`Initialized shielder_bindings in ${Date.now() - time}ms`);
  }
}
