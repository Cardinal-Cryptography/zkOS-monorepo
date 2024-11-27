import {
  ArrowRightCircle,
  Loader2,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatEther } from 'viem';

import { Address } from '@/components';
import { roundBalance } from '@/domains/account';
import type { Transaction as TransactionData } from '@/domains/transaction';
import cn from '@/utils/classnames';

type Props = {
  className?: string,
  tx: TransactionData,
};

const Transaction = ({ className, tx }: Props) => {
  return (
    <div className={cn(className, 'flex items-center text-xs')}>
      {tx.isFailed ? (
        <X className="mr-2 h-3 w-3 text-red-500" />
      ) : tx.isPending ? (
        <Loader2 className="mr-2 h-3 w-3 animate-spin text-yellow-500" />
      ) : tx.type === 'Shield' ? (
        <ShieldCheck className="mr-2 h-3 w-3 text-green-500" />
      ) : (
        <Shield className="mr-2 h-3 w-3 text-purple-500" />
      )}
      <span className="font-semibold mr-1">{tx.type}</span>
      <span>{roundBalance(formatEther(tx.amount))} AZERO</span>
      {tx.type === 'Send' && (
        <>
          <ArrowRightCircle className="mx-1 h-3 w-3" />
          <Address address={tx.to} />
        </>
      )}
      <span className="ml-auto text-gray-500">
        {tx.isPending ?
          'Processing...' :
          tx.isFailed ?
            'Failed' :
            new Date(tx.timestampMillis).toLocaleTimeString([], {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
      </span>
    </div>
  );
};

export default Transaction;
