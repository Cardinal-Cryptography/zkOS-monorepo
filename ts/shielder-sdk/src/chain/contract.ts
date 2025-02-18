import { CustomError } from "ts-custom-error";
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
import { AsymPublicKey } from "@cardinal-cryptography/shielder-sdk-crypto";

export class VersionRejectedByContract extends CustomError {
  public constructor() {
    super("Version rejected by contract");
  }
}

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
          throw new VersionRejectedByContract();
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
  anonymityRevokerPubkey: () => Promise<AsymPublicKey<bigint>>;
  newAccountCalldata: (
    expectedContractVersion: `0x${string}`,
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    symKeyEncryption: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  depositCalldata: (
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

  anonymityRevokerPubkey = async (): Promise<AsymPublicKey<bigint>> => {
    const key = await this.contract.read.anonymityRevokerPubkey();
    return {
      x: key[0],
      y: key[1]
    };
  };

  newAccountCalldata = async (
    expectedContractVersion: `0x${string}`,
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    symKeyEncryption: bigint,
    proof: Uint8Array
  ) => {
    await handleWrongContractVersionError(() => {
      return this.contract.simulate.newAccountNative(
        [
          expectedContractVersion,
          newNote,
          idHash,
          symKeyEncryption,
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
        symKeyEncryption,
        bytesToHex(proof)
      ]
    });
  };

  depositCalldata = async (
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
            : undefined
      } as NoteEvent;
    });
    return mergedIndices;
  };
}
