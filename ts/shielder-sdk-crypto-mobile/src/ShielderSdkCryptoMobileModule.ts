import { NativeModule, requireNativeModule } from "expo";

import { ShielderSdkCryptoMobileModuleEvents } from "./ShielderSdkCryptoMobile.types";

import {
  DepositAdvice,
  DepositPubInputs,
  NewAccountAdvice,
  NewAccountPubInputs,
  ShielderActionSecrets,
  WithdrawAdvice,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";

type BridgedBytesType = number[];

declare class ShielderSdkCryptoMobileModule extends NativeModule<ShielderSdkCryptoMobileModuleEvents> {
  // NewAccount circuit functions
  newAccountProve(
    advice: NewAccountAdvice<BridgedBytesType>
  ): Promise<Uint8Array>;
  newAccountVerify(
    pubInputs: NewAccountPubInputs<BridgedBytesType>,
    proof: number[]
  ): Promise<void>;
  newAccountPubInputs(
    advice: NewAccountAdvice<BridgedBytesType>
  ): Promise<NewAccountPubInputs<BridgedBytesType>>;

  // Deposit circuit functions
  depositProve(advice: DepositAdvice<BridgedBytesType>): Promise<Uint8Array>;
  depositVerify(
    pubInputs: DepositPubInputs<BridgedBytesType>,
    proof: number[]
  ): Promise<void>;
  depositPubInputs(
    advice: DepositAdvice<BridgedBytesType>
  ): Promise<DepositPubInputs<BridgedBytesType>>;

  // Withdraw circuit functions
  withdrawProve(advice: WithdrawAdvice<BridgedBytesType>): Promise<Uint8Array>;
  withdrawVerify(
    pubInputs: WithdrawPubInputs<BridgedBytesType>,
    proof: number[]
  ): Promise<void>;
  withdrawPubInputs(
    advice: WithdrawAdvice<BridgedBytesType>
  ): Promise<WithdrawPubInputs<BridgedBytesType>>;

  // Hasher interface
  poseidonHash(input: number[]): Promise<Uint8Array>;
  poseidonRate(): Promise<number>;

  // SecretManager interface
  getSecrets(
    id: number[],
    nonce: number
  ): Promise<ShielderActionSecrets<BridgedBytesType>>;
  deriveId(privateKey: string, tokenAddress: string): Promise<Uint8Array>;

  // Converter interface
  hex32ToScalar(hex: string): Promise<Uint8Array>;

  // NoteTreeConfig interface
  treeHeight(): Promise<number>;
  arity(): Promise<number>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ShielderSdkCryptoMobileModule>(
  "ShielderSdkCryptoMobile"
);
