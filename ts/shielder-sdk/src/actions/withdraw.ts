import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  Proof,
  Scalar,
  scalarToBigint,
  WithdrawAdvice,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Address, encodePacked, hexToBigInt, keccak256 } from "viem";
import { IRelayer, QuotedFees } from "@/chain/relayer";
import { NoteAction } from "@/actions/utils";
import { Token } from "@/types";
import { getAddressByToken } from "@/utils";
import { OutdatedSdkError } from "@/errors";
import { AccountState, AccountStateMerkleIndexed } from "@/state/types";
import { SendShielderTransaction } from "@/client/types";

export interface WithdrawCalldata {
  expectedContractVersion: `0x${string}`;
  calldata: {
    pubInputs: WithdrawPubInputs<Scalar>;
    proof: Proof;
  };
  provingTimeMillis: number;
  amount: bigint;
  withdrawalAddress: Address;
  quotedFees: QuotedFees;
  token: Token;
  pocketMoney: bigint;
}

export class WithdrawAction extends NoteAction {
  private contract: IContract;
  private relayer: IRelayer;
  private chainId: bigint;

  constructor(
    contract: IContract,
    relayer: IRelayer,
    cryptoClient: CryptoClient,
    chainId: bigint
  ) {
    super(cryptoClient);
    this.contract = contract;
    this.relayer = relayer;
    this.chainId = chainId;
  }

  /**
   * Return the updated state after withdrawing `amount` from `stateOld`.
   * Does not perform the actual withdrawal on blockchain.
   * @param stateOld
   * @param amount amount to withdraw
   * @returns updated state
   */
  async rawWithdraw(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await this.rawAction(
      stateOld,
      amount,
      (currentBalance: bigint, amount: bigint) => currentBalance - amount
    );
  }

  calculateCommitment(
    expectedContractVersion: `0x${string}`,
    address: `0x${string}`,
    relayerAddress: `0x${string}`,
    relayerFee: bigint,
    pocketMoney: bigint
  ): Scalar {
    const encodingHash = hexToBigInt(
      keccak256(
        encodePacked(
          ["bytes3", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [
            expectedContractVersion,
            hexToBigInt(address),
            hexToBigInt(relayerAddress),
            relayerFee,
            this.chainId,
            pocketMoney
          ]
        )
      )
    );

    // Truncating to fit in the field size, as in the contract.
    const commitment = encodingHash >> 4n;

    return Scalar.fromBigint(commitment);
  }

  async prepareAdvice(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    expectedContractVersion: `0x${string}`,
    withdrawalAddress: `0x${string}`,
    relayerAddress: `0x${string}`,
    totalFee: bigint,
    merklePath: Uint8Array,
    pocketMoney: bigint
  ): Promise<WithdrawAdvice<Scalar>> {
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

    const commitment = this.calculateCommitment(
      expectedContractVersion,
      withdrawalAddress,
      relayerAddress,
      totalFee,
      pocketMoney
    );

    return {
      id: state.id,
      nullifierOld,
      accountBalanceOld: Scalar.fromBigint(state.balance),
      tokenAddress: Scalar.fromAddress(tokenAddress),
      path: merklePath,
      value: Scalar.fromBigint(amount),
      nullifierNew,
      commitment,
      macSalt: await this.randomSalt()
    };
  }

  /**
   * Generate calldata for withdrawing `amount` from the account.
   * The amount must include the relayer fee, e.g. `amount = value + totalFee`,
   * where `value` is the targeted amount to withdraw.
   * @param state current account state
   * @param amount amount to withdraw, excluding the relayer fee
   * @param relayerAddress relayer address
   * @param quotedFees fee info quoted by the relayer
   * @param withdrawalAddress recipient address
   * @param expectedContractVersion expected contract version
   * @param pocketMoney pocket money that the relayer should pay to the account
   * @returns calldata for withdrawal action
   */
  async generateCalldata(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    relayerAddress: Address,
    quotedFees: QuotedFees,
    withdrawalAddress: Address,
    expectedContractVersion: `0x${string}`,
    pocketMoney: bigint
  ): Promise<WithdrawCalldata> {
    if (state.balance < amount) {
      throw new Error("Insufficient funds");
    }
    if (amount < quotedFees.fee_details.total_cost_fee_token) {
      throw new Error(
        `Amount must be greater than the relayer fee: ${quotedFees.fee_details.total_cost_fee_token.toString()}`
      );
    }
    if (state.token.type === "native" && pocketMoney > 0) {
      throw new Error("Pocket money is not supported for native withdrawal");
    }

    const lastNodeIndex = state.currentNoteIndex;
    const [merklePath] = await this.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    const time = Date.now();

    const advice = await this.prepareAdvice(
      state,
      amount,
      expectedContractVersion,
      withdrawalAddress,
      relayerAddress,
      quotedFees.fee_details.total_cost_fee_token,
      merklePath,
      pocketMoney
    );

    const { proof, pubInputs } = await this.cryptoClient.withdrawCircuit
      .prove(advice)
      .catch((e) => {
        throw new Error(`Failed to prove withdrawal: ${e}`);
      });
    if (!(await this.cryptoClient.withdrawCircuit.verify(proof, pubInputs))) {
      throw new Error("Withdrawal proof verification failed");
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
      withdrawalAddress,
      quotedFees,
      token: state.token,
      pocketMoney
    };
  }

  /**
   * Withdraw `amount` from the account.
   * Calls the relayer to perform the withdrawal on the blockchain.
   * @param calldata calldata for withdrawal action
   * @returns transaction hash of the withdrawal transaction
   * @throws VersionRejectedByRelayer
   */
  async sendCalldataWithRelayer(calldata: WithdrawCalldata) {
    const {
      expectedContractVersion,
      calldata: { pubInputs, proof },
      amount,
      withdrawalAddress,
      pocketMoney,
      quotedFees
    } = calldata;
    const { tx_hash: txHash } = await this.relayer
      .withdraw(
        expectedContractVersion,
        calldata.token,
        scalarToBigint(pubInputs.hNullifierOld),
        scalarToBigint(pubInputs.hNoteNew),
        scalarToBigint(pubInputs.merkleRoot),
        amount,
        proof,
        withdrawalAddress,
        scalarToBigint(pubInputs.macSalt),
        scalarToBigint(pubInputs.macCommitment),
        pocketMoney,
        quotedFees
      )
      .catch((e) => {
        if (e instanceof OutdatedSdkError) {
          throw e;
        }
        throw new Error(`Failed to withdraw: ${e}`);
      });
    return txHash as `0x${string}`;
  }

  async sendCalldata(
    calldata: WithdrawCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      amount,
      withdrawalAddress,
      quotedFees,
      pocketMoney
    } = calldata;
    const encodedCalldata =
      calldata.token.type === "native"
        ? await this.contract.withdrawNativeCalldata(
            calldata.expectedContractVersion,
            from,
            withdrawalAddress,
            from, // use sender as relayer
            quotedFees.fee_details.total_cost_native,
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof
          )
        : await this.contract.withdrawTokenCalldata(
            calldata.expectedContractVersion,
            calldata.token.address,
            from,
            withdrawalAddress,
            from, // use sender as relayer
            quotedFees.fee_details.total_cost_fee_token,
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            pocketMoney,
            proof
          );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata.calldata,
      to: this.contract.getAddress(),
      value: 0n,
      gas: encodedCalldata.gas
    }).catch((e) => {
      if (e instanceof OutdatedSdkError) {
        throw e;
      }
      throw new Error(`Failed to withdraw: ${e}`);
    });
    return txHash;
  }
}
