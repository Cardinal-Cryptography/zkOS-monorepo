import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Transaction } from './types/transaction';

import { useAccount } from '@/domains/account';
import { getItem, setItem } from '@/utils/storage';

const useRefreshTransaction = () => {
  const account = useAccount();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['refreshTransaction'],
    mutationFn: async (transaction: Transaction) => {
      if (!account) {
        throw new Error('Account is not available.');
      }

      if (!transaction.isPending) {
        throw new Error('Transaction is not pending.');
      }

      const receipt = await account.waitForTransactionReceipt({
        hash: transaction.txHash,
      });

      const transactions: Transaction[] = (await getItem('transactions')) ?? [];

      if (
        transactions.find((tx) => tx.txHash === transaction.txHash) ===
        undefined
      ) {
        throw new Error('Transaction not found.');
      }

      if (
        transactions.find((tx) => tx.txHash === transaction.txHash)
          ?.isPending == false
      ) {
        throw new Error('Transaction is not pending.');
      }

      const transactionUpdated: Transaction = {
        ...transaction,
        isPending: false,
        isFailed: receipt.status == 'reverted',
      };
      try {
        const currentTx = transactions.find(
          (tx) => tx.txHash === transaction.txHash
        );

        const newTxes = transactions.map((tx) =>
          tx.txHash === currentTx?.txHash ? transactionUpdated : tx
        );

        await setItem('transactions', newTxes);
      } catch (error) {
        console.log(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['transactions:all'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['balance:public'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['shielder:balance'],
      });
    },
  });

  return mutation;
};

export default useRefreshTransaction;
