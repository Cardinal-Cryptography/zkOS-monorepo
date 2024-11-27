import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setItem } from '@/utils/storage';

const useSetPrivateKey = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (privateKey: `0x${string}`) => {
      await setItem('privateKey', privateKey);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['privateKey'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['account'],
      });
    },
  });

  return mutation;
};

export default useSetPrivateKey;
