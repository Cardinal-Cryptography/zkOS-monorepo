export type TransactionType = 'Shield' | 'Send';
export type SendFrom = 'shielder';

type BaseTransaction = {
  from?: SendFrom,
  to?: `0x${string}`,
  amount: bigint,
  timestampMillis: number,
  isPending: boolean,
  isFailed?: boolean,
  txHash: `0x${string}`,
};

type ShieldTransaction = BaseTransaction & {
  type: 'Shield',
};

type SendTransaction = BaseTransaction & {
  type: 'Send',
  to: `0x${string}`,
  from: SendFrom,
};

export type Transaction = ShieldTransaction | SendTransaction;

export type PrivateTransaction = {
  type: TransactionType,
  amount: bigint,
  txHash: `0x${string}`,
  to?: `0x${string}`,
};
