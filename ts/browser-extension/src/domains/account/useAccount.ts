import { useQuery } from '@tanstack/react-query';
import { createAccount, type SeededAccount } from 'shielder-sdk';

import usePrivateKey from './usePrivateKey';

import { CONSTANTS } from '@/constants';

const useAccount = (): SeededAccount | undefined => {
  const privateKey = usePrivateKey();
  const { data: account } = useQuery({
    queryKey: ['account', privateKey],
    queryFn: () => {
      if (!privateKey) {
        throw new Error('No private key found.');
      }

      return createAccount(
        privateKey,
        CONSTANTS.CHAIN_ID,
        CONSTANTS.RPC_HTTP_ENDPOINT
      );
    },
  });

  return account;
};

export default useAccount;
