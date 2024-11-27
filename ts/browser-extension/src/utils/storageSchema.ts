import { type StateManagerStorageKeys, storageSchema as sdkStorageSchema } from 'shielder-sdk';
import { z } from 'zod';

type FrontendStorageKeys = 'privateKey' | 'transactions';

type StorageKeys = FrontendStorageKeys | StateManagerStorageKeys;

const validateBigInt = z.string().transform((value, ctx) => {
  try {
    return BigInt(value);
  } catch {
    ctx.addIssue({
      message: 'Invalid bigint string.',
      code: z.ZodIssueCode.custom,
      fatal: true,
    });
    return z.NEVER;
  }
});

const validateTxHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(val => val as `0x${string}`);

const baseTransactionSchema = z.object({
  amount: validateBigInt,
  timestampMillis: z.number(),
  isPending: z.boolean(),
  isFailed: z.boolean().optional(),
  txHash: validateTxHash,
});

const shieldTransactionSchema = baseTransactionSchema.extend({
  type: z.literal('Shield'),
});

const sendTransactionSchema = baseTransactionSchema.extend({
  type: z.literal('Send'),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(val => val as `0x${string}`),
  from: z.literal('shielder'),
});

const transactionSchema = z.union([shieldTransactionSchema, sendTransactionSchema]);

const frontendStorageSchema = {
  privateKey: z.string().startsWith('0x').nullable().transform(val => val as `0x${string}`),
  transactions: z.array(transactionSchema).nullable(),
};

const storageSchema = {
  ...sdkStorageSchema,
  ...frontendStorageSchema,
} satisfies Record<StorageKeys, z.ZodSchema>;

export default storageSchema;
export { type StorageKeys };
