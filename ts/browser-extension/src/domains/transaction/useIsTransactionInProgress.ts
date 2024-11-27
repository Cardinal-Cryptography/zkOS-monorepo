import { useMutationState } from '@tanstack/react-query';

import type { Transaction } from './types/transaction';

const useIsTransactionInProgress = (): [
  boolean,
  Transaction | undefined
] => {
  const isPending = useMutationState({
    filters: { mutationKey: ['refreshTransaction'], status: 'pending' },
    select: (mutation) => mutation.state.variables as Transaction,
  });

  if (isPending.length) {
    return [true, isPending[0]];
  }

  return [false, undefined];
};

export default useIsTransactionInProgress;
