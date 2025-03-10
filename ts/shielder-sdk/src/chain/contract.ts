import {
  Address,
  bytesToHex,
  encodeFunctionData,
  getContract,
  GetContractReturnType,
  Hash,
  PublicClient
} from "viem";
import { BaseError, ContractFunctionRevertedError } from "viem";

import { abi } from "../_generated/abi";
import { shieldActionGasLimit } from "@/constants";
import { OutdatedSdkError } from "@/errors";

export async function handleWrongContractVersionError<T>(
  func: () => Promise<T>
): Promise<T> {
  try {
    return await func();
  } catch (err) {
    // Following advice from
    // https://viem.sh/docs/contract/simulateContract#handling-custom-errors
    if (err instanceof BaseError) {
      const revertError = err.walk(
        (err) => err instanceof ContractFunctionRevertedError
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? "";
        if (errorName === "WrongContractVersion") {
          throw new OutdatedSdkError("Version rejected by contract");
        }
      }
    }
    throw err;
  }
}

export type NoteEvent = {
  name: "NewAccount" | "Deposit" | "Withdraw";
  contractVersion: `0x${string}`;
  amount: bigint;
  newNoteIndex: bigint;
  newNote: bigint;
  txHash: Hash;
  to?: Address;
  relayerFee?: bigint;
  block: bigint;
};

const getShielderContract = (
  account: PublicClient,
  contractAddress: Address
): GetContractReturnType<typeof abi, PublicClient, Address> => {
  return getContract({
    abi,
    address: contractAddress,
    client: account
  });
};

export type IContract = {
  getAddress: () => Address;
  getMerklePath: (idx: bigint) => Promise<readonly bigint[]>;
  anonymityRevokerPubkey: () => Promise<readonly [bigint, bigint]>;
  newAccountNativeCalldata: (
    expectedContractVersion: `0x${string}`,
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    symKeyEncryption1X: bigint,
    symKeyEncryption1Y: bigint,
    symKeyEncryption2X: bigint,
    symKeyEncryption2Y: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  newAccountTokenCalldata: (
    expectedContractVersion: `0x${string}`,
    tokenAddress: `0x${string}`,
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    symKeyEncryption1X: bigint,
    symKeyEncryption1Y: bigint,
    symKeyEncryption2X: bigint,
    symKeyEncryption2Y: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  depositNativeCalldata: (
    expectedContractVersion: `0x${string}`,
    from: Address,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  depositTokenCalldata: (
    expectedContractVersion: `0x${string}`,
    tokenAddress: `0x${string}`,
    from: Address,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  withdrawNativeCalldata: (
    expectedContractVersion: `0x${string}`,
    from: Address,
    withdrawalAddress: Address,
    relayerAddress: Address,
    relayerFee: bigint,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  withdrawTokenCalldata: (
    expectedContractVersion: `0x${string}`,
    tokenAddress: `0x${string}`,
    from: Address,
    withdrawalAddress: Address,
    relayerAddress: Address,
    relayerFee: bigint,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  nullifierBlock: (nullifierHash: bigint) => Promise<bigint | null>;
  getNoteEventsFromBlock: (block: bigint) => Promise<NoteEvent[]>;
};

export class Contract implements IContract {
  account: PublicClient;
  contract: ReturnType<typeof getShielderContract>;

  constructor(account: PublicClient, contractAddress: Address) {
    this.account = account;
    this.contract = getShielderContract(account, contractAddress);
  }

  getAddress = () => {
    return this.contract.address;
  };

  getMerklePath = async (idx: bigint): Promise<readonly bigint[]> => {
    const merklePath = await this.contract.read.getMerklePath([idx]);

    return merklePath as readonly bigint[];
  };

  anonymityRevokerPubkey = async (): Promise<readonly [bigint, bigint]> => {
    const key = await this.contract.read.anonymityRevokerPubkey();
    return key;
  };

  newAccountNativeCalldata = async (
    expectedContractVersion: `0x${string}`,
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    symKeyEncryption1X: bigint,
    symKeyEncryption1Y: bigint,
    symKeyEncryption2X: bigint,
    symKeyEncryption2Y: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.newAccountNative(
        [
          expectedContractVersion,
          newNote,
          idHash,
          symKeyEncryption1X,
          symKeyEncryption1Y,
          symKeyEncryption2X,
          symKeyEncryption2Y,
          bytesToHex(proof)
        ],
        { account: from, value: amount, gas: shieldActionGasLimit }
      );
    });
    return encodeFunctionData({
      abi,
      functionName: "newAccountNative",
      args: [
        expectedContractVersion,
        newNote,
        idHash,
        symKeyEncryption1X,
        symKeyEncryption1Y,
        symKeyEncryption2X,
        symKeyEncryption2Y,
        bytesToHex(proof)
      ]
    });
  };

  newAccountTokenCalldata = async (
    expectedContractVersion: `0x${string}`,
    tokenAddress: `0x${string}`,
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    symKeyEncryption1X: bigint,
    symKeyEncryption1Y: bigint,
    symKeyEncryption2X: bigint,
    symKeyEncryption2Y: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.newAccountERC20(
        [
          expectedContractVersion,
          tokenAddress,
          amount,
          newNote,
          idHash,
          symKeyEncryption1X,
          symKeyEncryption1Y,
          symKeyEncryption2X,
          symKeyEncryption2Y,
          bytesToHex(proof)
        ],
        { account: from, gas: shieldActionGasLimit }
      );
    });
    return encodeFunctionData({
      abi,
      functionName: "newAccountERC20",
      args: [
        expectedContractVersion,
        tokenAddress,
        amount,
        newNote,
        idHash,
        symKeyEncryption1X,
        symKeyEncryption1Y,
        symKeyEncryption2X,
        symKeyEncryption2Y,
        bytesToHex(proof)
      ]
    });
  };

  depositNativeCalldata = async (
    expectedContractVersion: `0x${string}`,
    from: Address,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.depositNative(
        [
          expectedContractVersion,
          idHiding,
          oldNoteNullifierHash,
          newNote,
          merkleRoot,
          macSalt,
          macCommitment,
          bytesToHex(proof)
        ],
        { account: from, value: amount, gas: shieldActionGasLimit }
      );
    });
    return encodeFunctionData({
      abi,
      functionName: "depositNative",
      args: [
        expectedContractVersion,
        idHiding,
        oldNoteNullifierHash,
        newNote,
        merkleRoot,
        macSalt,
        macCommitment,
        bytesToHex(proof)
      ]
    });
  };

  depositTokenCalldata = async (
    expectedContractVersion: `0x${string}`,
    tokenAddress: `0x${string}`,
    from: Address,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.depositERC20(
        [
          expectedContractVersion,
          tokenAddress,
          amount,
          idHiding,
          oldNoteNullifierHash,
          newNote,
          merkleRoot,
          macSalt,
          macCommitment,
          bytesToHex(proof)
        ],
        { account: from, gas: shieldActionGasLimit }
      );
    });
    return encodeFunctionData({
      abi,
      functionName: "depositERC20",
      args: [
        expectedContractVersion,
        tokenAddress,
        amount,
        idHiding,
        oldNoteNullifierHash,
        newNote,
        merkleRoot,
        macSalt,
        macCommitment,
        bytesToHex(proof)
      ]
    });
  };

  withdrawNativeCalldata = async (
    expectedContractVersion: `0x${string}`,
    from: Address,
    withdrawalAddress: Address,
    relayerAddress: Address,
    relayerFee: bigint,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.withdrawNative(
        [
          expectedContractVersion,
          idHiding,
          amount,
          withdrawalAddress,
          merkleRoot,
          oldNoteNullifierHash,
          newNote,
          bytesToHex(proof),
          relayerAddress,
          relayerFee,
          macSalt,
          macCommitment
        ],
        { account: from, gas: shieldActionGasLimit }
      );
    });
    return encodeFunctionData({
      abi,
      functionName: "withdrawNative",
      args: [
        expectedContractVersion,
        idHiding,
        amount,
        withdrawalAddress,
        merkleRoot,
        oldNoteNullifierHash,
        newNote,
        bytesToHex(proof),
        relayerAddress,
        relayerFee,
        macSalt,
        macCommitment
      ]
    });
  };

  withdrawTokenCalldata = async (
    expectedContractVersion: `0x${string}`,
    tokenAddress: `0x${string}`,
    from: Address,
    withdrawalAddress: Address,
    relayerAddress: Address,
    relayerFee: bigint,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    macSalt: bigint,
    macCommitment: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.withdrawERC20(
        [
          expectedContractVersion,
          idHiding,
          tokenAddress,
          amount,
          withdrawalAddress,
          merkleRoot,
          oldNoteNullifierHash,
          newNote,
          bytesToHex(proof),
          relayerAddress,
          relayerFee,
          macSalt,
          macCommitment
        ],
        { account: from, gas: shieldActionGasLimit }
      );
    });
    return encodeFunctionData({
      abi,
      functionName: "withdrawERC20",
      args: [
        expectedContractVersion,
        idHiding,
        tokenAddress,
        amount,
        withdrawalAddress,
        merkleRoot,
        oldNoteNullifierHash,
        newNote,
        bytesToHex(proof),
        relayerAddress,
        relayerFee,
        macSalt,
        macCommitment
      ]
    });
  };

  /**
   * Returns the block number in which the nullifier was used.
   * If the nullifier was not used, returns null
   * @param nullifierHash hash of the nullifier to look for
   * @returns block number in which the nullifier was used, or null if it was not used
   */
  nullifierBlock = async (nullifierHash: bigint): Promise<bigint | null> => {
    const blockNumber = await this.contract.read.nullifiers([nullifierHash]);
    if (blockNumber === 0n) {
      return null;
    }
    return blockNumber - 1n;
  };

  /**
   * Fetch the note indices from the contract by block number and filter them.
   * Stops fetching when the first event with tag is found.
   * @param block
   * @returns event array
   */
  getNoteEventsFromBlock = async (block: bigint) => {
    const fromBlock = block;
    const toBlock = block;
    const newAccountEvents = await this.contract.getEvents.NewAccount({
      fromBlock,
      toBlock
    });
    const depositEvents = await this.contract.getEvents.Deposit({
      fromBlock,
      toBlock
    });
    const withdrawEvents = await this.contract.getEvents.Withdraw({
      fromBlock,
      toBlock
    });
    const mergedIndices = [
      ...newAccountEvents,
      ...depositEvents,
      ...withdrawEvents
    ].map((event) => {
      return {
        name: event.eventName,
        contractVersion: event.args.contractVersion,
        amount: event.args.amount!,
        newNoteIndex: event.args.newNoteIndex!,
        newNote: event.args.newNote!,
        txHash: event.transactionHash,
        block: event.blockNumber,
        to:
          event.eventName === "Withdraw"
            ? (event.args.withdrawalAddress as Address)
            : undefined,
        relayerFee:
          event.eventName === "Withdraw"
            ? (event.args.fee as bigint)
            : undefined
      } as NoteEvent;
    });
    return mergedIndices;
  };
}
