import { useQuery } from '@tanstack/react-query';
import { ShielderClient } from 'shielder-sdk';

import { CONSTANTS } from '@/constants';
import { usePrivateKey } from '@/domains/account';
import { getItem, setItem } from '@/utils/storage';

const useShielderClient = () => {
  const privateKey = usePrivateKey();
  const { data: shielderClient } = useQuery({
    queryKey: ['shielder:client', privateKey],
    queryFn: () => {
      if (!privateKey) {
        throw new Error('No private key found.');
      }

      return new ShielderClient(
        privateKey,
        CONSTANTS.CHAIN_ID,
        CONSTANTS.RPC_HTTP_ENDPOINT,
        CONSTANTS.SHIELDER_CONTRACT_ADDRESS,
        CONSTANTS.RELAYER_ADDRESS,
        CONSTANTS.RELAYER_URL,
        getItem,
        setItem
      );
    },
  });

  return shielderClient;
};

export default useShielderClient;
