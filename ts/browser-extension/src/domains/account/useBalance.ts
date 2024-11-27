import { useQuery } from '@tanstack/react-query';

import useAccount from './useAccount';

import { CONSTANTS } from '@/constants';

const useBalance = () => {
  const account = useAccount();
  const { data: balance } = useQuery({
    queryKey: ['balance:public', account],
    queryFn: async () => {
      if (!account) {
        throw new Error('No account found.');
      }

      return await account.getBalance({
        address: account.account.address,
      });
    },
    initialData: 0n,
    refetchInterval: CONSTANTS.BALANCE_REFETCH_INTERVAL,
  });

  return balance;
};

export default useBalance;
