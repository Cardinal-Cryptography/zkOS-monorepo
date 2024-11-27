import { parseEther } from 'viem';
import { z } from 'zod';

const validateShieldTransactionAmount =
(balance: bigint, gasCost: bigint) =>
  (amountRaw: string, ctx: z.RefinementCtx): void => {
    let amount = BigInt(0);

    try {
      amount = parseEther(amountRaw);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid amount.',
        fatal: true,
      });
      return z.NEVER;
    }

    if (amount === BigInt(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount cannot be zero.',
        fatal: true,
      });
      return z.NEVER;
    }

    if (amount + gasCost > balance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Insufficient balance to execute transaction. Set lower value.',
        fatal: true,
        path: ['azero'],
      });
      return z.NEVER;
    }
  };

export default validateShieldTransactionAmount;
