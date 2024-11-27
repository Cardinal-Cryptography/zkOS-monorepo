import { useQuery } from '@tanstack/react-query';

import { getItem } from '@/utils/storage';

const usePrivateKey = () => {
  const { data: privateKey } = useQuery({
    queryKey: ['privateKey'],
    queryFn: async () => {
      const key: `0x${string}` | null = await getItem('privateKey');

      return key;
    },
  });

  return privateKey;
};

export default usePrivateKey;
