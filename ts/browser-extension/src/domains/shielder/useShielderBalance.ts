import { useQuery } from '@tanstack/react-query';

import useShielderClient from './useShielderClient';

const useShielderBalance = () => {
  const shielderClient = useShielderClient();
  const { data: balance } = useQuery({
    // disabled exhaustive-deps because shielderClient is not serializing properly
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['shielder:balance', shielderClient?.account],
    queryFn: async () => {
      if (!shielderClient) {
        return 0n;
      }

      return await shielderClient.balance();
    },
    initialData: 0n,
  });

  return balance;
};

export default useShielderBalance;
