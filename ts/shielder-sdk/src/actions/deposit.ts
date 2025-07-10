import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  DepositAdvice,
  DepositPubInputs,
  Proof,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Calldata } from "./types";
import { NoteAction } from "@/actions/utils";
import { Token } from "@/types";
import { getAddressByToken } from "@/utils";
import { OutdatedSdkError } from "@/errors";
import { AccountState, AccountStateMerkleIndexed } from "@/state/types";
import { SendShielderTransaction } from "@/client/types";
import { Address, encodePacked, hexToBigInt, keccak256 } from "viem";

export interface DepositCalldata extends Calldata {
  calldata: {
    pubInputs: DepositPubInputs<Scalar>;
    proof: Proof;
  };
  expectedContractVersion: `0x${string}`;
  amount: bigint;
  token: Token;
  memo: Uint8Array;
}

export class DepositAction extends NoteAction {
  private contract: IContract;

  constructor(contract: IContract, cryptoClient: CryptoClient) {
    super(cryptoClient);
    this.contract = contract;
  }

  /**
   * Return the updated state after depositing `amount` into `stateOld`.
   * Does not perform the actual deposit on blockchain.
   * @param stateOld
   * @param amount amount to deposit
   * @returns updated state
   */
  async rawDeposit(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await this.rawAction(
      stateOld,
      amount,
      (currentBalance: bigint, amount: bigint) => currentBalance + amount
    );
  }

  calculateCommitment(callerAddress: Address, protocolFee: bigint): Scalar {
    const encodingHash = hexToBigInt(
      keccak256(
        encodePacked(["address", "uint256"], [callerAddress, protocolFee])
      )
    );

    // Truncating to fit in the field size, as in the contract.
    const commitment = encodingHash >> 4n;

    return Scalar.fromBigint(commitment);
  }

  async prepareAdvice(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    merklePath: Uint8Array,
    callerAddress: Address,
    protocolFee: bigint
  ): Promise<DepositAdvice<Scalar>> {
    const tokenAddress = getAddressByToken(state.token);

    const { nullifier: nullifierOld } =
      await this.cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce - 1n)
      );
    const { nullifier: nullifierNew } =
      await this.cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce)
      );

    const commitment = this.calculateCommitment(callerAddress, protocolFee);

    return {
      id: state.id,
      nullifierOld,
      accountBalanceOld: Scalar.fromBigint(state.balance),
      tokenAddress: Scalar.fromAddress(tokenAddress),
      path: merklePath,
      value: Scalar.fromBigint(amount),
      commitment,
      nullifierNew,
      macSalt: await this.randomSalt()
    };
  }

  /**
   * Generate calldata for depositing `amount` into the account.
   * @param state current account state
   * @param amount amount to deposit
   * @param expectedContractVersion expected contract version
   * @param callerAddress address of the caller
   * @returns calldata for deposit action
   */
  async generateCalldata(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    expectedContractVersion: `0x${string}`,
    callerAddress: Address,
    protocolFee: bigint,
    memo: Uint8Array
  ): Promise<DepositCalldata> {
    const lastNodeIndex = state.currentNoteIndex;
    const [merklePath] = await this.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    const time = Date.now();

    const advice = await this.prepareAdvice(
      state,
      amount,
      merklePath,
      callerAddress,
      protocolFee
    );

    const proof = await this.cryptoClient.depositCircuit
      .prove(advice)
      .catch((e) => {
        throw new Error(`Failed to prove deposit: ${e}`);
      });
    const pubInputs = await this.cryptoClient.depositCircuit.pubInputs(advice);
    if (!(await this.cryptoClient.depositCircuit.verify(proof, pubInputs))) {
      throw new Error("Deposit proof verification failed");
    }

    const provingTime = Date.now() - time;
    return {
      calldata: {
        pubInputs,
        proof
      },
      expectedContractVersion,
      provingTimeMillis: provingTime,
      amount,
      token: state.token,
      memo
    };
  }

  /**
   * Deposit `amount` into the account.
   * Calls the contract through RPC endpoint to perform the deposit on the blockchain.
   * @param calldata calldata for deposit action
   * @param sendShielderTransaction function to send the transaction to the blockchain
   * @param callerAddress address of the caller
   * @returns transaction hash of the deposit transaction
   * @throws VersionRejectedByContract
   */
  async sendCalldata(
    calldata: DepositCalldata,
    sendShielderTransaction: SendShielderTransaction,
    callerAddress: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      amount,
      memo
    } = calldata;
    const encodedCalldata =
      calldata.token.type === "native"
        ? await this.contract.depositNativeCalldata(
            calldata.expectedContractVersion,
            callerAddress,
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof,
            memo
          )
        : await this.contract.depositTokenCalldata(
            calldata.expectedContractVersion,
            calldata.token.address,
            callerAddress,
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
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
      throw new Error(`Failed to deposit: ${e}`);
    });
    return txHash;
  }
}
