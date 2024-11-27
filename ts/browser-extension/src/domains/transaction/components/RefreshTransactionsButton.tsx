import { RefreshCcw } from 'lucide-react';

import { useShielderIsReady, useShielderSync } from '@/domains/shielder';
import cn from '@/utils/classnames';

export type RefreshTransactionButtonProps = {
  className?: string,
};

export const RefreshTransactionsButton = (
  props: RefreshTransactionButtonProps
) => {
  const shielderSync = useShielderSync();
  const shielderIsReady = useShielderIsReady();

  return (
    <>
      {shielderIsReady ? (
        <RefreshCcw
          className={cn(
            props.className,
            'w-6 h-6 text-black hover:text-blue-500 cursor-pointer'
          )}
          onClick={() => void shielderSync.mutate()}
        />
      ) : (
        <RefreshCcw className={cn(props.className, 'w-6 h-6 text-gray-300')} />
      )}
    </>
  );
};
