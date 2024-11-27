import { useQuery } from '@tanstack/react-query';

import type { Transaction } from './types/transaction';

import { getItem } from '@/utils/storage';

const useTransactions = () => {
  const { data: transactions } = useQuery({
    queryKey: ['transactions:all'],
    queryFn: async () => {
      const transactions: Transaction[] = (await getItem('transactions')) ?? [];

      return transactions.sort((a, b) => b.timestampMillis - a.timestampMillis);
    },
    initialData: [],
  });

  return transactions;
};

export default useTransactions;
