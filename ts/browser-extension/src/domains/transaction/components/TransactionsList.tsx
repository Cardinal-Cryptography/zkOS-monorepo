import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import useRefreshTransaction from '../useRefreshTransaction';
import useTransactions from '../useTransactions';

import { RefreshTransactionsButton } from './RefreshTransactionsButton';
import Transaction from './Transaction';

import { Button } from '@/components';

const TransactionsList = () => {
  const transactions = useTransactions();
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 5;

  // Get current transactions
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = transactions.slice(
    indexOfFirstTransaction,
    indexOfLastTransaction
  );

  const refreshTransaction = useRefreshTransaction();

  // Change page
  const paginate = (pageNumber: number) => void setCurrentPage(pageNumber);

  transactions.forEach((tx) => {
    if (!refreshTransaction.isPending && tx.isPending) {
      refreshTransaction.mutate(tx);
    }
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex-1" />
        <h3 className="text-sm font-semibold flex-1 text-center">
          Recent Private Transactions
        </h3>
        <div className="flex-1 flex justify-end">
          <RefreshTransactionsButton className="bg-gray-100 rounded" />
        </div>
      </div>
      {currentTransactions.map((tx, index) => (
        <Transaction key={index} tx={tx} />
      ))}
      <div className="flex justify-between items-center  mt-2">
        <Button
          onClick={() => void paginate(currentPage - 1)}
          disabled={currentPage === 1}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs">Page {currentPage}</span>
        <Button
          onClick={() => void paginate(currentPage + 1)}
          disabled={indexOfLastTransaction >= transactions.length}
          size="sm"
          variant="ghost"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default TransactionsList;
