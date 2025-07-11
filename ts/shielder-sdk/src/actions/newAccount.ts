import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  NewAccountAdvice,
  NewAccountPubInputs,
  Proof,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { NoteAction } from "@/actions/utils";
import { Token } from "@/types";
import { getAddressByToken } from "@/utils";
import { OutdatedSdkError } from "@/errors";
import { AccountState } from "@/state/types";
import { SendShielderTransaction } from "@/client/types";
import { Address, encodePacked, hexToBigInt, keccak256 } from "viem";

export interface NewAccountCalldata {
  calldata: {
    pubInputs: NewAccountPubInputs<Scalar>;
    proof: Proof;
  };
  expectedContractVersion: `0x${string}`;
  provingTimeMillis: number;
  amount: bigint;
  token: Token;
  memo: Uint8Array;
}

export class NewAccountAction extends NoteAction {
  contract: IContract;

  constructor(contract: IContract, cryptoClient: CryptoClient) {
    super(cryptoClient);
    this.contract = contract;
  }

  /**
   * Return the updated state after creating a new account with an initial deposit.
   * Does not perform the actual account creation on blockchain.
   * @param stateOld
   * @param amount initial deposit
   * @returns updated state
   */
  async rawNewAccount(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await this.rawAction(
      stateOld,
      amount,
      (currentBalance: bigint, amount: bigint) => amount
    );
  }

  calculateCommitment(callerAddress: Address, protocolFee: bigint): Scalar {
    const encodingHash = hexToBigInt(
      keccak256(
        encodePacked(
          ["uint256", "uint256"],
          [scalarToBigint(Scalar.fromAddress(callerAddress)), protocolFee]
        )
      )
    );

    // Truncating to fit in the field size, as in the contract.
    const commitment = encodingHash >> 4n;

    return Scalar.fromBigint(commitment);
  }

  async prepareAdvice(
    state: AccountState,
    amount: bigint,
    callerAddress: Address,
    protocolFee: bigint
  ): Promise<NewAccountAdvice<Scalar>> {
    const tokenAddress = getAddressByToken(state.token);
    const { nullifier } = await this.cryptoClient.secretManager.getSecrets(
      state.id,
      Number(state.nonce)
    );
    const [anonymityRevokerPublicKeyX, anonymityRevokerPublicKeyY] =
      await this.contract.anonymityRevokerPubkey();

    const commitment = this.calculateCommitment(callerAddress, protocolFee);
    return {
      id: state.id,
      nullifier,
      tokenAddress: Scalar.fromAddress(tokenAddress),
      initialDeposit: Scalar.fromBigint(amount - protocolFee),
      commitment,
      encryptionSalt: await this.randomSalt(),
      anonymityRevokerPublicKeyX: Scalar.fromBigint(anonymityRevokerPublicKeyX),
      anonymityRevokerPublicKeyY: Scalar.fromBigint(anonymityRevokerPublicKeyY),
      macSalt: await this.randomSalt()
    };
  }

  /**
   * Generate calldata for creation of a new account with an initial deposit.
   * @param state current account state
   * @param amount initial deposit
   * @param expectedContractVersion expected contract version
   * @param callerAddress address of the caller
   * @returns calldata for new account action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint,
    expectedContractVersion: `0x${string}`,
    callerAddress: Address,
    protocolFee: bigint,
    memo: Uint8Array
  ): Promise<NewAccountCalldata> {
    const time = Date.now();

    const advice = await this.prepareAdvice(
      state,
      amount,
      callerAddress,
      protocolFee
    );

    const { proof, pubInputs } = await this.cryptoClient.newAccountCircuit
      .prove(advice)
      .catch((e) => {
        throw new Error(`Failed to prove new account: ${e}`);
      });
    if (!(await this.cryptoClient.newAccountCircuit.verify(proof, pubInputs))) {
      throw new Error("New account proof verification failed");
    }

    const provingTime = Date.now() - time;
    return {
      expectedContractVersion,
      calldata: {
        pubInputs,
        proof
      },
      provingTimeMillis: provingTime,
      amount,
      token: state.token,
      memo
    };
  }

  /**
   * Create a new account with an initial deposit.
   * Calls the contract through RPC endpoint to create the account on the blockchain.
   * @param calldata calldata for new account action
   * @param sendShielderTransaction function to send the transaction to the blockchain
   * @param from address of the caller
   * @returns transaction hash of the new account transaction
   */
  async sendCalldata(
    calldata: NewAccountCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      expectedContractVersion,
      amount,
      memo
    } = calldata;

    const encodedCalldata =
      calldata.token.type === "native"
        ? await this.contract.newAccountNativeCalldata(
            expectedContractVersion,
            from,
            scalarToBigint(pubInputs.hNote),
            scalarToBigint(pubInputs.prenullifier),
            amount,
            scalarToBigint(pubInputs.symKeyEncryption1X),
            scalarToBigint(pubInputs.symKeyEncryption1Y),
            scalarToBigint(pubInputs.symKeyEncryption2X),
            scalarToBigint(pubInputs.symKeyEncryption2Y),
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof,
            memo
          )
        : await this.contract.newAccountTokenCalldata(
            expectedContractVersion,
            calldata.token.address,
            from,
            scalarToBigint(pubInputs.hNote),
            scalarToBigint(pubInputs.prenullifier),
            amount,
            scalarToBigint(pubInputs.symKeyEncryption1X),
            scalarToBigint(pubInputs.symKeyEncryption1Y),
            scalarToBigint(pubInputs.symKeyEncryption2X),
            scalarToBigint(pubInputs.symKeyEncryption2Y),
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof,
            memo
          );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata.calldata,
      to: this.contract.getAddress(),
      value: calldata.token.type === "native" ? amount : 0n,
      gas: encodedCalldata.gas
    }).catch((e) => {
      if (e instanceof OutdatedSdkError) {
        throw e;
      }
      throw new Error(`Failed to create new account: ${e}`);
    });
    return txHash;
  }
}
