import { useMutation, useQueryClient } from '@tanstack/react-query';

import useShielderClient from './useShielderClient';
import useWasm from './useWasm';

import { useEnqueueTransactions, type Transaction } from '@/domains/transaction';

const useShielderSync = () => {
  const { isWasmLoaded } = useWasm();
  const shielderClient = useShielderClient();
  const queryClient = useQueryClient();
  const enqueueTransactions = useEnqueueTransactions();

  return useMutation({
    mutationKey: ['shielder:sync'],
    mutationFn: async () => {
      if (!isWasmLoaded) {
        throw new Error('WASM not loaded.');
      }

      if (!shielderClient) {
        throw new Error('Shielder client not initialized.');
      }

      console.log('Syncing shielder');

      try {
        return await shielderClient.syncAccountState();
      } catch (error) {
        console.error('Error syncing shielder', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ['shielder:balance'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['shielder:isReady'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['transactions:all'],
      });

      const mappedTransactions: Transaction[] = data.map((tx) => {
        if (tx.type == 'WithdrawNative' && tx.to) {
          return {
            type: 'Send',
            from: 'shielder',
            to: tx.to,
            amount: tx.amount,
            timestampMillis: tx.timestampMillis,
            isPending: true,
            isFailed: false,
            txHash: tx.txHash,
          };
        } else {
          return {
            type: 'Shield',
            amount: tx.amount,
            timestampMillis: tx.timestampMillis,
            isPending: true,
            isFailed: false,
            txHash: tx.txHash,
          };
        }
      });

      await enqueueTransactions.mutateAsync(mappedTransactions);
    },
  });
};

export default useShielderSync;
