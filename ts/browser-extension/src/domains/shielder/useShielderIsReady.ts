import { useMutationState, useQuery } from '@tanstack/react-query';

import useWasm from './useWasm';

const useShielderIsReady = () => {
  const { isWasmLoaded } = useWasm();
  const pendingShielderSyncs = useMutationState({
    filters: { mutationKey: ['shielder:sync'], status: 'pending' },
  });
  const { data: shielderIsReady } = useQuery({
    queryKey: ['shielder:isReady', isWasmLoaded, pendingShielderSyncs],
    queryFn: () => {
      return isWasmLoaded && pendingShielderSyncs.length === 0;
    },
    initialData: false,
  });

  return shielderIsReady;
};

export default useShielderIsReady;
