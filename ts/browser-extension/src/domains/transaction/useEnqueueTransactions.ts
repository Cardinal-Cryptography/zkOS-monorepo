import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Transaction } from './types/transaction';

import { getItem, setItem } from '@/utils/storage';

const useEnqueueTransactions = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['enqueueTransactions'],
    mutationFn: async (transactions: Transaction[]) => {
      for (const transaction of transactions) {
        if (!transaction.isPending) {
          throw new Error('Transaction is not pending.');
        }
      }

      const oldTransactions: Transaction[] = await getItem('transactions') ?? [];
      const newTxes: Transaction[] = [...oldTransactions, ...transactions];
      await setItem('transactions', newTxes);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['transactions:all'],
      });
    },
  });

  return mutation;
};

export default useEnqueueTransactions;
