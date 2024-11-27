import { useQuery } from '@tanstack/react-query';

import { CONSTANTS } from '@/constants';
import { useAccount } from '@/domains/account';

const useCurrentGasPrice = () => {
  const account = useAccount();
  const { data: currentGasPrice } = useQuery({
    queryKey: ['currentGasPrice', account],
    queryFn: async () => {
      if (!account) {
        throw new Error('No account found.');
      }

      const { maxFeePerGas: gasPrice } = await account.estimateFeesPerGas();
      return gasPrice;
    },
    initialData: 0n,
    refetchInterval: CONSTANTS.GAS_PRICE_REFETCH_INTERVAL,
  });

  return currentGasPrice;
};

export default useCurrentGasPrice;
